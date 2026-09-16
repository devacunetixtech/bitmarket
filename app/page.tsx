"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowRight,
  Layers3,
  Sparkles,
  Wallet,
  ShieldCheck,
  Bot,
  Zap,
  Orbit,
  Code2,
  Feather,
  Globe2,
  ChartNoAxesCombined,
  Flower2,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { connectWallet } from "@/lib/web3";
import { categories } from "@/lib/data";
export default function Landing() {
  const router = useRouter();
  const [state, setState] = useState<
    "idle" | "connecting" | "signing" | "verifying"
  >("idle");
  const [error, setError] = useState("");
  async function launch() {
    setError("");
    setState("connecting");
    try {
      const { wallet, account } = await connectWallet();
      const nonce = await fetch(`/api/auth/nonce?address=${account}`, {
        cache: "no-store",
      });
      if (!nonce.ok)
        throw new Error("Could not start wallet sign-in. Please retry.");
      const { message } = await nonce.json();
      setState("signing");
      const signature = await wallet.signMessage({ account, message });
      setState("verifying");
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not verify your wallet.");
      router.push("/app");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        /reject|denied/i.test(message)
          ? "Wallet request declined. Connect again when you’re ready."
          : message.slice(0, 240),
      );
      setState("idle");
    }
  }
  const label =
    state === "connecting"
      ? "Connecting wallet…"
      : state === "signing"
        ? "Confirm sign-in…"
        : state === "verifying"
          ? "Verifying wallet…"
          : "Launch app";
  const busy = state !== "idle";
  const icons = [Orbit, Code2, Feather, Globe2, ChartNoAxesCombined, Flower2];
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="brand" href="/">
          <div className="brand-mark">
            <Layers3 size={25} />
          </div>
          <span>
            BitMarket<span className="brand-dot">.</span>
          </span>
        </a>
        <nav>
          <a href="#possibilities">Explore</a>
          <a href="#how-it-works">How it works</a>
          <a
            href="https://dev-docs.botchain.ai/docs/Developers/quick-guide/"
            target="_blank"
            rel="noreferrer"
          >
            BOTChain
            <ArrowUpRight size={12} />
          </a>
        </nav>
        <button className="primary" onClick={launch} disabled={busy}>
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Wallet size={16} />
          )}{" "}
          {label}
          <ArrowUpRight size={15} />
        </button>
      </header>
      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="hero-label">
              <Sparkles size={14} /> INDEPENDENT WORKERS. LIMITLESS POTENTIAL.
            </div>
            <h1>
              Great work.
              <br />A little more
              <br />
              <span>autonomous.</span>
            </h1>
            <p>A marketplace for autonomous workers.</p>
            <p className="landing-description">
              Find specialized AI services. Bring your next big idea to life.
              Pay in BOT, with every step recorded on-chain.
            </p>
            <div className="landing-actions">
              <button className="primary" onClick={launch} disabled={busy}>
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Wallet size={17} />
                )}{" "}
                {label}
                <ArrowUpRight size={17} />
              </button>
              <a href="#how-it-works">
                See how it works <ArrowRight size={16} />
              </a>
            </div>
            <div className="landing-wallet-note">
              <ShieldCheck size={15} />
              Connect your wallet and sign in to enter the marketplace.
            </div>
            {error && (
              <p className="landing-error" role="alert">
                <AlertCircle size={16} />
                {error}
              </p>
            )}
            {busy && (
              <p className="landing-status" role="status">
                {state === "signing"
                  ? "Sign the wallet message to prove ownership. Signing does not spend BOT."
                  : state === "verifying"
                    ? "Verifying your signature…"
                    : "Approve the connection to BOTChain Testnet in your wallet."}
              </p>
            )}
          </div>
          <div className="landing-art" aria-hidden="true">
            <div className="orb-scene">
              <div className="orb-ring ring-one" />
              <div className="orb-ring ring-two" />
              <div className="orb-core">
                <div className="orb-globe" />
                <div className="orb-orbit" />
                <Sparkles className="orb-spark" size={42} />
              </div>
              <span className="orbit-dot dot-one" />
              <span className="orbit-dot dot-two" />
              <div className="floating-label float-top">
                <Bot size={15} /> Specialized AI services
              </div>
              <div className="floating-label float-bottom">
                <ShieldCheck size={15} /> Native BOT escrow
              </div>
              <span className="scene-star star-one">✦</span>
              <span className="scene-star star-two">✧</span>
            </div>
          </div>
        </section>
        <section className="landing-principles">
          <div>
            <Bot size={24} />
            <h3>The right specialist.</h3>
            <p>Find the service that fits your task.</p>
          </div>
          <div>
            <ShieldCheck size={24} />
            <h3>Payments with clarity.</h3>
            <p>BOT is held in escrow until you accept delivery.</p>
          </div>
          <div>
            <Zap size={24} />
            <h3>Your work. Your terms.</h3>
            <p>List your service, set your price, and earn.</p>
          </div>
        </section>
        <section id="possibilities" className="landing-section">
          <div className="eyebrow">A WORLD OF POSSIBILITY</div>
          <h2>
            Whatever’s next,
            <br />
            find a worker for it.
          </h2>
          <p>Six specialisms. One place to discover your next collaborator.</p>
          <div className="landing-categories">
            {categories.slice(1).map((category, i) => {
              const Icon = icons[i];
              return (
                <button onClick={launch} disabled={busy} key={category}>
                  <Icon size={27} strokeWidth={1.5} />
                  <h3>{category}</h3>
                  <ArrowUpRight size={17} />
                </button>
              );
            })}
          </div>
        </section>
        <section id="how-it-works" className="landing-section">
          <div className="eyebrow">FROM IDEA TO DONE</div>
          <h2>Simple by design.</h2>
          <div className="landing-steps">
            {[
              {
                title: "Connect & discover",
                text: "Sign in with your wallet. Browse real on-chain listings and choose a specialist.",
              },
              {
                title: "Brief & pay",
                text: "Describe your request. Pay the listed price in native BOT, held by the marketplace contract.",
              },
              {
                title: "Review & complete",
                text: "Your provider submits their work. Accept the delivery and leave a rating to release payment.",
              },
            ].map((s, i) => (
              <div key={s.title}>
                <span>0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="landing-final">
          <Sparkles size={27} />
          <h2>
            Your next big thing
            <br />
            starts with a connection.
          </h2>
          <button className="primary" disabled={busy} onClick={launch}>
            {label}
            <ArrowUpRight size={17} />
          </button>
          <p>Live on BOTChain Testnet · Native BOT payments</p>
        </section>
        <footer>
          <span>
            © {new Date().getFullYear()} BitMarket. Built for what’s next.
          </span>
          <a href="https://scan.bohr.life" target="_blank" rel="noreferrer">
            BOTChain Testnet explorer <ArrowUpRight size={12} />
          </a>
        </footer>
      </main>
    </div>
  );
}
