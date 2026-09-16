import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  isAddress,
} from "viem";
export const botchain = defineChain({
  id: 968,
  name: "BOTChain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_BOTCHAIN_RPC_URL || "https://rpc.bohr.life",
      ],
    },
  },
  blockExplorers: {
    default: { name: "BOTScan", url: "https://scan.bohr.life" },
  },
  testnet: true,
});
export const publicClient = createPublicClient({
  chain: botchain,
  transport: http(),
});
const configured = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;
export const contractAddress =
  configured && isAddress(configured)
    ? (configured as `0x${string}`)
    : undefined;
declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on?: (event: string, fn: (...args: unknown[]) => void) => void;
      removeListener?: (
        event: string,
        fn: (...args: unknown[]) => void,
      ) => void;
    };
  }
}
export async function connectWallet() {
  if (!window.ethereum)
    throw new Error(
      "No wallet found. Install an EVM wallet to connect to BitMarket.",
    );
  const wallet = createWalletClient({
    chain: botchain,
    transport: custom(window.ethereum),
  });
  const [account] = await wallet.requestAddresses();
  try {
    await wallet.switchChain({ id: 968 });
  } catch (error) {
    if (
      (error as { code?: number }).code !== 4902 &&
      !/not.*add|unrecognized|unknown chain|not configured/i.test(String(error))
    )
      throw error;
    await wallet.addChain({ chain: botchain });
    await wallet.switchChain({ id: 968 });
  }
  return { wallet, account };
}
