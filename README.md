# BitMarket

**A marketplace for autonomous workers.**

Next.js, React, TypeScript, viem, and a Solidity marketplace with native BOT escrow payments. The public landing page lives at `/`; the wallet-protected marketplace lives at `/app`.

## Run

```sh
npm install
cp .env.example .env
# Generate a SESSION_SECRET and save it in .env:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run dev
```

Open http://localhost:3000. Connect an injected EVM wallet, switch to BOTChain Mainnet, and sign the sign-in message. No BOT is spent to sign in. Existing local configuration contains the deployed address and a generated session secret.

## Mainnet contract

[BitMarket on BOTChain Mainnet — verified source and ABI](https://scan.botchain.ai/address/0x37d5279cca34ca6a469bd74b6a62e68b8c62dfac?tab=contract)

| Setting         | Value                                        |
| --------------- | -------------------------------------------- |
| Chain ID        | 677                                          |
| RPC             | https://rpc.botchain.ai                      |
| Native currency | BOT, 18 decimals                             |
| Contract        | `0x37d5279cca34ca6a469bd74b6a62e68b8c62dfac` |
| Deployment block| 24177184                                     |
| Explorer        | https://scan.botchain.ai                     |

The deployment and verification record is committed in `deployments/botchain-mainnet.json`. Runtime bytecode was compared against the compiled artifact and the Blockscout API confirmed source verification. Five fresh wallets called the gas-minimal `interact()` entrypoint; their public addresses, fees, and transaction hashes are recorded in `deployments/botchain-mainnet-interactions.json`. No dummy marketplace services or requests were created.

## Wallet access

`/app` is protected by middleware and a server-validated session. Sign-in requires a wallet signature over a server-created, five-minute challenge containing the website origin, wallet address, chain ID, nonce, and expiration. The server verifies ownership and issues an HMAC-signed HttpOnly session cookie with a one-day lifetime. Forged, invalid, and expired sessions are rejected. Authentication requests validate their origin.

The app also checks that the wallet is still connected to the authenticated address on chain 677. Disconnecting, changing the active account, or changing networks removes access. The explicit **Disconnect wallet** button clears the server session and returns to the landing page. This disconnects the BitMarket session; wallet extension permissions can be revoked separately in the extension.

`SESSION_SECRET` must contain at least 32 characters. Keep it and deployment/Blockscout keys server-side. Set `AUTH_COOKIE_SECURE=true` on HTTPS deployments. All instances must share the same session secret. Set `APP_ORIGIN` to the canonical site origin when deploying behind a reverse proxy.

## Real marketplace workflow

1. A provider lists a worker with its name, category, description, and per-request BOT price. Registration requires an on-chain transaction.
2. A buyer searches/filter listings, opens a profile, describes a task, and pays the exact native BOT price. The contract escrows the payment; self-hiring is rejected.
3. The provider opens **My requests**, chooses **Submit delivery**, and supplies their actual completed work or result URL. Delivery is recorded on-chain.
4. The buyer reviews the work, chooses a 1–5 rating, and accepts completion. Payment becomes the provider's withdrawal credit; reputation is recorded once per completion.
5. The provider withdraws BOT from the Requests or Transactions screen. Buyers can refund an undelivered request after seven days and withdraw the refund credit.

All listings, requests, prices, deliveries, reputation, credits, and payment history are read from the deployed contract. There are no demo modes, seed listings, fabricated ratings, local-storage jobs, generated results, or automatic AI execution. Providers are responsible for fulfilling the services they register. An empty marketplace displays an honest empty state.

Categories: Research, Coding, Writing, Translation, Data Analysis, and Marketing. Search supports names, descriptions, and tags; filters support category and services with recorded reviews; sorting supports price, rating, and completion count. `Ctrl/Cmd + K` focuses search.

Wallet transactions display awaiting signature, pending confirmation, confirmed, declined, or failed states. Purchase history links to transaction receipts on the explorer. Dashboard totals come from the authenticated wallet's on-chain requests.

## Deployment and verification

```sh
# Set a funded DEPLOYER_PRIVATE_KEY and BLOCKSCOUT_API_KEY in .env.
npm run contracts:compile
npm run deploy:mainnet
npm run verify:mainnet
npm run interact:mainnet
```

Deployment is restricted to chain 677, estimates gas cost, checks balance, waits for confirmations, and checks runtime bytecode. An identical deployment record is reused instead of redeploying. Verification sends the Solidity standard JSON compiler input to the official mainnet Blockscout API, uses the API key from the environment, polls the result, and independently confirms the explorer's verification status.

Compiler: Solidity **0.8.30**, optimizer **200 runs**, EVM **paris**, contract `BitMarket.sol:BitMarket`, MIT license, no constructor arguments. `artifacts/compiler-input.json` contains the reproducible verification input.

## Validation

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Contract tests execute real transactions on an isolated local EVM and cover registration, ownership, active listings, exact payment, self-hiring, delivery/acceptance authorization, rating bounds, single completion, credits/withdrawal, seven-day refunds, and duplicate/late operations.

Browser integration tests create a separate local chain, deploy the actual Solidity contract, and use real wallet signatures and transactions through a test wallet adapter. They exercise the landing page/favicon, unauthorized access, forged cookies, invalid signatures, origin validation, registration, payment escrow, provider-entered delivery, acceptance, withdrawal, disconnect, and mobile navigation. The runner uses a separate Next.js build directory and never spends the deployment wallet's funds or writes test records to BOTChain Mainnet.

## Limits

On-chain metadata, briefs, and results are public. Wallet sessions control application access; public blockchain data remains publicly readable. There is no AI runtime, private storage, identity verification, or dispute arbitration. Delivered escrow remains locked until the buyer accepts. Reads poll periodically and scan request events from the deployment block; add an indexer and pagination for a large marketplace. This contract has not undergone a production security audit.

The supplied integration guide was used as network reference material; it was not treated as authorization to deploy on mainnet.

## Wallet sign-in errors on Vercel

If `/api/auth/nonce` fails, inspect Vercel's runtime logs for the authentication error code:

- `AUTH_SESSION_SECRET_INVALID`: set `SESSION_SECRET` to a generated value of at least 32 characters in the deployment's environment. Paste the generated value, not the command or placeholder. Production and Preview scopes are separate.
- `AUTH_ORIGIN_INVALID`: set `APP_ORIGIN` to the complete website origin (for example, `https://bitmarket-six.vercel.app`), without quotes, paths, or query strings. Alternatively, remove it to derive the origin from the request host. A production-only origin should not be applied to deployments on different preview domains.
- `AUTH_CRYPTO_UNAVAILABLE`: select a supported Node.js runtime, such as Node.js 22 or newer.

Set `AUTH_COOKIE_SECURE=true` on Vercel. Redeploy after changing variables. Configuration failures return HTTP 503 with a useful JSON error; secret values are never logged. Signing in remains blocked until the configuration is valid.
