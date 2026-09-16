import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import ganache from "ganache";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { artifact } from "../scripts/compile.mjs";
let provider, client, wallets, accounts, address;
const chain = defineChain({
  id: 1337,
  name: "Local test",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});
const price = parseEther("12");
before(async () => {
  provider = ganache.provider({
    logging: { quiet: true },
    chain: { chainId: 1337 },
    wallet: { totalAccounts: 4 },
  });
  accounts = Object.values(provider.getInitialAccounts()).map((a) =>
    privateKeyToAccount(a.secretKey),
  );
  client = createPublicClient({ chain, transport: custom(provider) });
  wallets = accounts.map((account) =>
    createWalletClient({ chain, account, transport: custom(provider) }),
  );
  const hash = await wallets[0].deployContract({
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`,
  });
  address = (await client.waitForTransactionReceipt({ hash })).contractAddress;
});
after(async () => {
  await provider.disconnect();
});
async function write(index, fn, args = [], value = 0n) {
  const hash = await wallets[index].writeContract({
    address,
    abi: artifact.abi,
    functionName: fn,
    args,
    value,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
  return receipt;
}
async function read(fn, args = []) {
  return client.readContract({
    address,
    abi: artifact.abi,
    functionName: fn,
    args,
  });
}
async function rejects(index, fn, args = [], value = 0n) {
  await assert.rejects(() =>
    client.simulateContract({
      account: accounts[index],
      address,
      abi: artifact.abi,
      functionName: fn,
      args,
      value,
    }),
  );
}
test("register services and reject invalid price and metadata", async () => {
  await rejects(0, "registerService", ["", price]);
  await rejects(0, "registerService", ["{}", 0n]);
  const receipt = await write(0, "registerService", [
    JSON.stringify({ name: "Atlas", category: "Research" }),
    price,
  ]);
  assert.equal(await read("serviceCount"), 1n);
  assert.equal(receipt.logs.length, 1);
  const service = await read("services", [0n]);
  assert.equal(service[0].toLowerCase(), accounts[0].address.toLowerCase());
  assert.equal(service[2], price);
});
test("only provider may change pricing and availability", async () => {
  await rejects(1, "updateService", [0n, price, false]);
  await write(0, "updateService", [0n, price, false]);
  await rejects(1, "requestService", [0n, "research"], price);
  await write(0, "updateService", [0n, price, true]);
});
test("require exact native BOT payment and prevent self-hiring", async () => {
  await rejects(1, "requestService", [0n, "research"], price - 1n);
  await rejects(1, "requestService", [0n, "research"], price + 1n);
  await rejects(0, "requestService", [0n, "research"], price);
  await rejects(1, "requestService", [0n, ""], price);
  await write(1, "requestService", [0n, "Research the market"], price);
  assert.equal(await client.getBalance({ address }), price);
  assert.equal((await read("jobs", [0n]))[5], 0);
});
test("delivery permissions, buyer approval, reputation and withdrawal", async () => {
  await rejects(2, "deliverService", [0n, "result"]);
  await rejects(1, "completeService", [0n, 5]);
  await rejects(1, "refundService", [0n]);
  await write(0, "deliverService", [0n, "Delivered research report"]);
  await rejects(0, "deliverService", [0n, "duplicate"]);
  await rejects(2, "completeService", [0n, 5]);
  await rejects(1, "completeService", [0n, 0]);
  await rejects(1, "completeService", [0n, 6]);
  await write(1, "completeService", [0n, 5]);
  assert.equal((await read("jobs", [0n]))[5], 2);
  assert.equal(await read("credits", [accounts[0].address]), price);
  const service = await read("services", [0n]);
  assert.equal(service[4], 5n);
  assert.equal(service[5], 1n);
  await rejects(1, "completeService", [0n, 5]);
  await write(0, "withdraw");
  assert.equal(await read("credits", [accounts[0].address]), 0n);
  assert.equal(await client.getBalance({ address }), 0n);
  await rejects(0, "withdraw");
});
test("timeout refunds retain buyer control and cannot be claimed twice", async () => {
  await write(1, "requestService", [0n, "Another task"], price);
  await rejects(1, "refundService", [1n]);
  await provider.request({
    method: "evm_increaseTime",
    params: [7 * 86400 + 1],
  });
  await provider.request({ method: "evm_mine", params: [] });
  await rejects(2, "refundService", [1n]);
  await write(1, "refundService", [1n]);
  assert.equal((await read("jobs", [1n]))[5], 3);
  assert.equal(await read("credits", [accounts[1].address]), price);
  await rejects(1, "refundService", [1n]);
  await rejects(0, "deliverService", [1n, "late"]);
  await write(1, "withdraw");
  assert.equal(await client.getBalance({ address }), 0n);
});
test("delivered requests cannot be refunded after timeout", async () => {
  await write(1, "requestService", [0n, "Third task"], price);
  await write(0, "deliverService", [2n, "result"]);
  await provider.request({
    method: "evm_increaseTime",
    params: [7 * 86400 + 1],
  });
  await provider.request({ method: "evm_mine", params: [] });
  await rejects(1, "refundService", [2n]);
  await write(1, "completeService", [2n, 3]);
  const service = await read("services", [0n]);
  assert.equal(service[4], 8n);
  assert.equal(service[5], 2n);
});
