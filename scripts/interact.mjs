import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { marketplaceAbi } from "../lib/abi.ts";

const rpc = process.env.BOTCHAIN_RPC_URL || "https://rpc.botchain.ai";
const chain = defineChain({
  id: 677,
  name: "BOTChain Mainnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const publicClient = createPublicClient({ chain, transport: http(rpc) });
if ((await publicClient.getChainId()) !== 677)
  throw new Error("RPC chain ID does not match BOTChain mainnet");

const deployment = JSON.parse(readFileSync("artifacts/deployment-677.json"));
const contract = deployment.address;
const key = process.env.DEPLOYER_PRIVATE_KEY?.trim();
if (!key) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env");
const deployer = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const funder = createWalletClient({
  account: deployer,
  chain,
  transport: http(rpc),
});

const secretsPath = "artifacts/mainnet-interaction-wallets.json";
let secrets;
if (existsSync(secretsPath)) {
  secrets = JSON.parse(readFileSync(secretsPath));
} else {
  secrets = Array.from({ length: 5 }, () => {
    const privateKey = generatePrivateKey();
    return { privateKey, address: privateKeyToAccount(privateKey).address };
  });
  writeFileSync(secretsPath, JSON.stringify(secrets, null, 2), { mode: 0o600 });
}
if (secrets.length !== 5) throw new Error("Expected exactly five interaction wallets");

const publicPath = "deployments/botchain-mainnet-interactions.json";
const record = existsSync(publicPath)
  ? JSON.parse(readFileSync(publicPath))
  : { chainId: 677, contract, wallets: [] };
if (record.contract.toLowerCase() !== contract.toLowerCase())
  throw new Error("Interaction record belongs to a different contract");

for (const secret of secrets) {
  if (record.wallets.some((wallet) => wallet.address.toLowerCase() === secret.address.toLowerCase()))
    continue;
  const account = privateKeyToAccount(secret.privateKey);
  const gasPrice = await publicClient.getGasPrice();
  const interactionGas = await publicClient.estimateContractGas({
    account: deployer,
    address: contract,
    abi: marketplaceAbi,
    functionName: "interact",
  });
  const required = interactionGas * gasPrice;
  const current = await publicClient.getBalance({ address: account.address });
  let fundingHash;
  if (current < required) {
    fundingHash = await funder.sendTransaction({
      to: account.address,
      value: required - current,
      gasPrice,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: fundingHash });
    if (receipt.status !== "success") throw new Error(`Funding failed for ${account.address}`);
  }
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  const interactionHash = await wallet.writeContract({
    address: contract,
    abi: marketplaceAbi,
    functionName: "interact",
    gas: interactionGas,
    gasPrice,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: interactionHash });
  if (receipt.status !== "success") throw new Error(`Interaction failed for ${account.address}`);
  record.wallets.push({
    address: account.address,
    fundingHash,
    interactionHash,
    gasUsed: receipt.gasUsed.toString(),
    gasPrice: receipt.effectiveGasPrice.toString(),
    feeBOT: formatEther(receipt.gasUsed * receipt.effectiveGasPrice),
  });
  writeFileSync(publicPath, JSON.stringify(record, null, 2));
  console.log("Interaction confirmed:", account.address, interactionHash);
}

console.log("Five-wallet interaction record:", publicPath);
