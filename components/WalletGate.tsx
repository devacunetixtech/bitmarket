"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import Marketplace from "./Marketplace";
export default function WalletGate({ address }: { address: `0x${string}` }) {
  const router = useRouter();
  const [valid, setValid] = useState(false);
  const disconnect = useCallback(async () => {
    setValid(false);
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error();
      router.replace("/");
      router.refresh();
    } catch {
      window.location.replace("/?connect=required");
    }
  }, [router]);
  useEffect(() => {
    let alive = true;
    const provider = window.ethereum;
    const check = async () => {
      try {
        if (!provider) throw new Error();
        const [accounts, chain] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" }),
        ]);
        if (
          (accounts as string[])[0]?.toLowerCase() !== address.toLowerCase() ||
          Number(chain) !== 968
        )
          throw new Error();
        if (alive) setValid(true);
      } catch {
        if (alive) void disconnect();
      }
    };
    void check();
    provider?.on?.("accountsChanged", check);
    provider?.on?.("chainChanged", check);
    provider?.on?.("disconnect", disconnect);
    const timer = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
      provider?.removeListener?.("accountsChanged", check);
      provider?.removeListener?.("chainChanged", check);
      provider?.removeListener?.("disconnect", disconnect);
    };
  }, [address, disconnect]);
  if (!valid)
    return (
      <div className="wallet-check" role="status">
        <LoaderCircle size={26} className="spin" />
        <p>Checking your wallet connection…</p>
      </div>
    );
  return <Marketplace connectedAccount={address} onDisconnect={disconnect} />;
}
