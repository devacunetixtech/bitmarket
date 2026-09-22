import ganache from "ganache";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { artifact } from "./compile.mjs";
const server = ganache.server({
  logging: { quiet: true },
  chain: { chainId: 677 },
  wallet: { totalAccounts: 3, defaultBalance: 1000 },
});
await server.listen(9545, "127.0.0.1");
try {
  const keys = Object.values(server.provider.getInitialAccounts()).map(
    (a) => a.secretKey,
  );
  const chain = defineChain({
    id: 677,
    name: "Isolated BOT EVM",
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
    rpcUrls: { default: { http: ["http://127.0.0.1:9545"] } },
  });
  const client = createPublicClient({ chain, transport: http() });
  const wallet = createWalletClient({
    account: privateKeyToAccount(keys[0]),
    chain,
    transport: http(),
  });
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  const child = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        E2E_PROVIDER_KEY: keys[0],
        E2E_BUYER_KEY: keys[1],
        E2E_RPC: "http://127.0.0.1:9545",
        NEXT_PUBLIC_BOTCHAIN_RPC_URL: "http://127.0.0.1:9545",
        NEXT_PUBLIC_MARKETPLACE_ADDRESS: receipt.contractAddress,
        NEXT_PUBLIC_MARKETPLACE_DEPLOYMENT_BLOCK: "0",
        NEXT_DIST_DIR: ".next-e2e",
        SESSION_SECRET: randomBytes(32).toString("hex"),
        AUTH_COOKIE_SECURE: "false",
      },
    },
  );
  process.exitCode = await new Promise((resolve) =>
    child.on("exit", (code) => resolve(code ?? 1)),
  );
} finally {
  await server.close();
}
