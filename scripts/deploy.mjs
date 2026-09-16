import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { artifact } from "./compile.mjs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const rpc = process.env.BOTCHAIN_RPC_URL || "https://rpc.bohr.life";
if (!process.env.DEPLOYER_PRIVATE_KEY)
  throw new Error("Set DEPLOYER_PRIVATE_KEY in .env");
if (Number(process.env.BOTCHAIN_CHAIN_ID || 968) !== 968)
  throw new Error("Deployment is restricted to testnet 968");
const chain = defineChain({
  id: 968,
  name: "BOTChain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY.trim());
const client = createPublicClient({ chain, transport: http(rpc) });
if ((await client.getChainId()) !== 968)
  throw new Error("RPC chain ID does not match testnet");
const record = "artifacts/deployment-968.json";
if (existsSync(record)) {
  const existing = JSON.parse(readFileSync(record));
  const bytecode = await client.getCode({ address: existing.address });
  if (bytecode === `0x${artifact.evm.deployedBytecode.object}`) {
    console.log("Reusing deployed contract:", existing.address);
    process.exit(0);
  }
  throw new Error(
    "Existing deployment record differs from compiled code. Review before redeploying.",
  );
}
const gas = await client.estimateGas({
  account,
  data: `0x${artifact.evm.bytecode.object}`,
});
const gasPrice = await client.getGasPrice();
const balance = await client.getBalance({ address: account.address });
const gasLimit = (gas * 120n) / 100n;
console.log("Deployer:", account.address);
console.log("Balance:", formatEther(balance), "BOT");
console.log("Estimated gas cost:", formatEther(gasLimit * gasPrice), "BOT");
if (balance < gasLimit * gasPrice)
  throw new Error("Insufficient testnet BOT for estimated deployment gas");
const wallet = createWalletClient({ account, chain, transport: http(rpc) });
const hash = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: `0x${artifact.evm.bytecode.object}`,
  gas: gasLimit,
  gasPrice,
});
writeFileSync(
  "artifacts/deployment-pending-968.json",
  JSON.stringify({ chainId: 968, hash, deployer: account.address }, null, 2),
);
console.log("Deployment submitted:", hash);
const receipt = await client.waitForTransactionReceipt({
  hash,
  confirmations: 2,
  timeout: 180000,
});
if (receipt.status !== "success" || !receipt.contractAddress)
  throw new Error("Deployment reverted");
const code = await client.getCode({ address: receipt.contractAddress });
if (code !== `0x${artifact.evm.deployedBytecode.object}`)
  throw new Error("Deployed runtime bytecode does not match compiled contract");
writeFileSync(
  record,
  JSON.stringify(
    {
      chainId: 968,
      address: receipt.contractAddress,
      hash,
      deployer: account.address,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      verified: false,
    },
    null,
    2,
  ),
);
console.log("Deployed contract:", receipt.contractAddress);
console.log("Runtime bytecode matches the compiled contract.");
