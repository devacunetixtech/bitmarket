import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  createWalletClient,
  createPublicClient,
  defineChain,
  http,
  hexToString,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { marketplaceAbi } from "../../lib/abi";
const chain = defineChain({
  id: 968,
  name: "Isolated BOT EVM",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [process.env.E2E_RPC!] } },
});
const address = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;
const client = createPublicClient({ chain, transport: http() });
async function injectWallet(context: BrowserContext, key: `0x${string}`) {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: http() });
  await context.exposeBinding(
    "walletRequest",
    async (_, args: { method: string; params?: unknown[] }) => {
      const params = args.params || [];
      if (
        args.method === "eth_requestAccounts" ||
        args.method === "eth_accounts"
      )
        return [account.address];
      if (
        args.method === "wallet_switchEthereumChain" ||
        args.method === "wallet_addEthereumChain"
      )
        return null;
      if (args.method === "personal_sign")
        return account.signMessage({
          message: hexToString(params[0] as `0x${string}`),
        });
      if (args.method === "eth_sendTransaction") {
        const tx = params[0] as {
          to: `0x${string}`;
          data: `0x${string}`;
          value?: string;
          gas?: string;
          gasPrice?: string;
        };
        return wallet.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: BigInt(tx.value || "0"),
          gas: tx.gas ? BigInt(tx.gas) : undefined,
          gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
        });
      }
      const response = await fetch(process.env.E2E_RPC!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: args.method,
          params,
        }),
      });
      const body = await response.json();
      if (body.error) throw new Error(body.error.message);
      return body.result;
    },
  );
  await context.addInitScript(() => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    window.ethereum = {
      request: (args) =>
        (
          window as unknown as {
            walletRequest: (args: unknown) => Promise<unknown>;
          }
        ).walletRequest(args),
      on: (event, fn) => {
        (listeners[event] ||= []).push(fn);
      },
      removeListener: (event, fn) => {
        listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
      },
    };
    (
      window as unknown as { disconnectTestWallet: () => void }
    ).disconnectTestWallet = () => listeners.disconnect?.forEach((fn) => fn());
  });
}
async function signIn(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Launch app", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL("/app");
  await expect(
    page.getByRole("heading", { name: "Meet your next teammate." }),
  ).toBeVisible();
}
test("landing, favicon, wallet gate and rejection of forged sessions", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Great work. A little more autonomous.",
    }),
  ).toBeVisible();
  const icon = await page
    .locator('link[rel="icon"]')
    .first()
    .getAttribute("href");
  expect((await page.request.get(icon!)).status()).toBe(200);
  await page.goto("/app");
  await expect(page).toHaveURL(/connect=required/);
  await context.addCookies([
    {
      name: "bitmarket-session",
      value: "forged.invalid",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/app");
  await expect(page).toHaveURL(/connect=required/);
  await page
    .getByRole("button", { name: "Launch app", exact: true })
    .first()
    .click();
  await expect(page.getByRole("alert")).toContainText("No wallet found");
  expect(await page.locator(".worker-card").count()).toBe(0);
});
test("invalid signature and cross-origin login are rejected", async ({
  request,
}) => {
  const account = privateKeyToAccount(
    process.env.E2E_PROVIDER_KEY as `0x${string}`,
  );
  const nonce = await request.get(`/api/auth/nonce?address=${account.address}`);
  const { message } = await nonce.json();
  const invalid = await request.post("/api/auth/session", {
    headers: { Origin: "http://127.0.0.1:3001" },
    data: { message, signature: `0x${"00".repeat(65)}` },
  });
  expect(invalid.status()).toBe(401);
  const crossOrigin = await request.post("/api/auth/session", {
    headers: { Origin: "https://invalid.example" },
    data: {},
  });
  expect(crossOrigin.status()).toBe(403);
});
test("real wallet signatures, registration, escrow, provider delivery, acceptance, withdrawal and disconnect", async ({
  browser,
}) => {
  const provider = await browser.newContext();
  const buyer = await browser.newContext();
  await injectWallet(provider, process.env.E2E_PROVIDER_KEY as `0x${string}`);
  await injectWallet(buyer, process.env.E2E_BUYER_KEY as `0x${string}`);
  const p = await provider.newPage();
  const b = await buyer.newPage();
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  b.on("pageerror", (e) => errors.push(e.message));
  await signIn(p);
  await expect(p.locator(".worker-card")).toHaveCount(0);
  await p
    .locator("main")
    .getByRole("button", { name: "List a worker", exact: true })
    .click();
  const form = p.getByRole("dialog");
  await form.getByLabel("Worker name").fill("Research service");
  await form
    .getByLabel("Service description")
    .fill("Provider-delivered research and sourced analysis.");
  await form.getByLabel("Price per request (BOT)").fill("0.01");
  await form.getByRole("button", { name: "List worker on testnet" }).click();
  await expect(
    p.getByRole("heading", { name: "Research service", exact: true }),
  ).toBeVisible();
  await signIn(b);
  await b.locator("#worker-search").fill("Research service");
  await expect(b.locator(".worker-card")).toHaveCount(1);
  await b.getByRole("button", { name: "View worker", exact: true }).click();
  await b
    .getByLabel("What would you like this worker to do?")
    .fill("Provide sources for the BOTChain network configuration.");
  await b.getByRole("button", { name: "Pay & request" }).click();
  await expect(b.locator(".status-badge")).toHaveText("In progress");
  expect(await client.getBalance({ address })).toBe(10000000000000000n);
  await p.reload();
  await p.getByRole("button", { name: /^My requests/ }).click();
  await p.getByRole("button", { name: "Submit delivery", exact: true }).click();
  await p
    .getByLabel("Delivery content or result URL")
    .fill(
      "Official configuration: chain ID 968; native currency BOT. Source: https://dev-docs.botchain.ai/docs/Developers/quick-guide/",
    );
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Submit delivery", exact: true })
    .click();
  await expect(p.locator(".status-badge")).toHaveText("Ready for review");
  await b.reload();
  await b.getByRole("button", { name: /^My requests/ }).click();
  await b.getByRole("button", { name: "Review delivery" }).click();
  await expect(b.locator(".delivery-result")).toContainText(
    "Official configuration",
  );
  await b.getByRole("button", { name: "Rate 4 stars" }).click();
  await b.getByRole("button", { name: "Accept & complete" }).click();
  await expect(b.locator(".status-badge")).toHaveText("Completed");
  const providerAccount = privateKeyToAccount(
    process.env.E2E_PROVIDER_KEY as `0x${string}`,
  );
  expect(
    await client.readContract({
      address,
      abi: marketplaceAbi,
      functionName: "credits",
      args: [providerAccount.address],
    }),
  ).toBe(10000000000000000n);
  await p.reload();
  await p.getByRole("button", { name: "Transactions", exact: true }).click();
  await p.getByRole("button", { name: "Withdraw BOT" }).click();
  await expect(
    p.getByText("BOT credit withdrawn to your wallet."),
  ).toBeVisible();
  expect(await client.getBalance({ address })).toBe(0n);
  await b.getByRole("button", { name: "Disconnect wallet" }).click();
  await expect(b).toHaveURL("/");
  await b.goto("/app");
  await expect(b).toHaveURL(/connect=required/);
  await p.evaluate(() =>
    (
      window as unknown as { disconnectTestWallet: () => void }
    ).disconnectTestWallet(),
  );
  await expect(p).toHaveURL("/");
  expect(errors).toEqual([]);
  await provider.close();
  await buyer.close();
});
test("mobile landing and authenticated navigation fit viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await injectWallet(context, process.env.E2E_BUYER_KEY as `0x${string}`);
  const page = await context.newPage();
  await signIn(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: /^My requests/ }).click();
  await expect(
    page.getByRole("heading", { name: "Good work, in motion." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Disconnect wallet" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await context.close();
});
