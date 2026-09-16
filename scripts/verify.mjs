import { readFileSync, writeFileSync } from "node:fs";
import solc from "solc";
const path = "artifacts/deployment-968.json";
const deployment = JSON.parse(readFileSync(path));
if (deployment.chainId !== 968)
  throw new Error("Verification is restricted to BOTChain testnet");
if (!process.env.BLOCKSCOUT_API_KEY)
  throw new Error("Set BLOCKSCOUT_API_KEY in .env");
const base = process.env.BOTCHAIN_VERIFIER_URL || "https://scan.bohr.life/api";
const url = new URL(base);
if (url.origin !== "https://scan.bohr.life")
  throw new Error("Verifier must be the official BOTChain testnet explorer");
async function request(action, fields = {}) {
  const target = new URL(url);
  target.searchParams.set("module", "contract");
  target.searchParams.set("action", action);
  const form = new URLSearchParams({
    ...fields,
    apikey: process.env.BLOCKSCOUT_API_KEY.trim(),
  });
  try {
    const r = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) throw new Error(`Blockscout HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    throw new Error(`Verification API request failed (${e.name})`);
  }
}
const submitted = await request("verifysourcecode", {
  contractaddress: deployment.address,
  sourceCode: readFileSync("artifacts/compiler-input.json", "utf8"),
  codeformat: "solidity-standard-json-input",
  contractname: "BitMarket.sol:BitMarket",
  compilerversion: `v${solc.version().split(".Emscripten")[0]}`,
  constructorArguments: "",
  licenseType: "3",
});
if (
  submitted.status !== "1" &&
  !/already verified/i.test(submitted.result || "")
)
  throw new Error(
    "Blockscout rejected verification: " +
      String(submitted.result).replaceAll(
        process.env.BLOCKSCOUT_API_KEY,
        "[redacted]",
      ),
  );
console.log("Verification submitted.");
if (!/already verified/i.test(submitted.result || "")) {
  for (let i = 0; i < 30; i++) {
    const status = await request("checkverifystatus", {
      guid: submitted.result,
    });
    if (/pass|already verified/i.test(status.result || "")) break;
    if (!/pending|queue|unknown uid/i.test(status.result || ""))
      throw new Error(
        "Verification failed: " +
          String(status.result).replaceAll(
            process.env.BLOCKSCOUT_API_KEY,
            "[redacted]",
          ),
      );
    console.log("Verification pending…");
    await new Promise((r) => setTimeout(r, 5000));
  }
}
const response = await fetch(
  `${url.origin}/api/v2/smart-contracts/${deployment.address}`,
  { signal: AbortSignal.timeout(30000) },
);
if (!response.ok) throw new Error("Could not confirm explorer verification");
const contract = await response.json();
if (!contract.is_verified)
  throw new Error("Explorer has not confirmed verification");
deployment.verified = true;
deployment.verifiedAt = new Date().toISOString();
deployment.explorer = `${url.origin}/address/${deployment.address}?tab=contract`;
writeFileSync(path, JSON.stringify(deployment, null, 2));
console.log("Verified contract:", deployment.address);
console.log("Explorer:", deployment.explorer);
