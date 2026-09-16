"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  LayoutGrid,
  Bot,
  ListOrdered,
  ArrowLeftRight,
  BookOpen,
  CircleHelp,
  ChevronDown,
  Plus,
  Wallet,
  X,
  Check,
  Star,
  Globe2,
  Code2,
  Feather,
  ChartNoAxesCombined,
  Flower2,
  Orbit,
  SlidersHorizontal,
  ShieldCheck,
  Zap,
  Clock3,
  ExternalLink,
  Menu,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Layers3,
  Compass,
  LogOut,
} from "lucide-react";
import { formatEther, parseEther } from "viem";
import { categories, type Worker, type Job, type Category } from "@/lib/data";
import {
  botchain,
  connectWallet,
  contractAddress,
  publicClient,
} from "@/lib/web3";
import { marketplaceAbi } from "@/lib/abi";
type View = "Marketplace" | "My workers" | "My requests" | "Transactions";
type Modal = "register" | "how" | "help" | null;
type Tx = {
  stage: "idle" | "signing" | "pending" | "success" | "error";
  message: string;
  hash?: `0x${string}`;
};
const icons = {
  orbit: Orbit,
  code: Code2,
  feather: Feather,
  language: Globe2,
  chart: ChartNoAxesCombined,
  flower: Flower2,
};
function Avatar({
  worker,
  large = false,
}: {
  worker: Worker;
  large?: boolean;
}) {
  const Icon = icons[worker.icon as keyof typeof icons] || Bot;
  return (
    <div className={`avatar ${worker.color} ${large ? "large" : ""}`}>
      <Icon size={large ? 34 : 25} strokeWidth={1.7} />
    </div>
  );
}
function BotCoin({ size = 15 }: { size?: number }) {
  return (
    <span
      className="botcoin"
      style={{ width: size, height: size, fontSize: size * 0.65 }}
    >
      ฿
    </span>
  );
}
export default function Marketplace({
  connectedAccount,
  onDisconnect,
}: {
  connectedAccount: `0x${string}`;
  onDisconnect: () => Promise<void>;
}) {
  const [view, setView] = useState<View>("Marketplace");
  const [category, setCategory] = useState<Category>("All workers");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Recommended");
  const [onlyReviewed, setOnlyReviewed] = useState(false);
  const [allWorkers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState<Worker | null>(null);
  const [brief, setBrief] = useState("");
  const [mobile, setMobile] = useState(false);
  const account = connectedAccount;
  const [loading, setLoading] = useState(true);
  const [deliveryJob, setDeliveryJob] = useState<Job | null>(null);
  const [delivery, setDelivery] = useState("");
  const [tx, setTx] = useState<Tx>({ stage: "idle", message: "" });
  const [limit, setLimit] = useState(6);
  const [rating, setRating] = useState(5);
  const [resultJob, setResultJob] = useState<Job | null>(null);
  const [credits, setCredits] = useState("0");
  const [loadError, setLoadError] = useState("");
  const busy = tx.stage === "signing" || tx.stage === "pending";
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("Marketplace");
        setTimeout(() => document.getElementById("worker-search")?.focus(), 0);
      }
      if (event.key === "Escape" && !busy) {
        setModal(null);
        setSelected(null);
        setResultJob(null);
        setDeliveryJob(null);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [busy]);
  useEffect(() => {
    if (!modal && !selected && !resultJob && !deliveryJob) return;
    const previous = document.activeElement as HTMLElement;
    const timer = setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(
            ".modal input, .modal textarea, .modal button",
          )
          ?.focus(),
      30,
    );
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".modal button:not(:disabled), .modal input, .modal textarea, .modal select, .modal a",
        ),
      );
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal, selected, resultJob, deliveryJob]);
  useEffect(() => {
    void refreshLive(account);
    const interval = setInterval(() => void refreshLive(account, true), 20000);
    return () => clearInterval(interval);
  }, [account]);
  async function refreshLive(walletAccount = account, background = false) {
    if (!contractAddress) {
      setLoadError("Marketplace contract is not configured.");
      setLoading(false);
      return;
    }
    if (!background) setLoading(true);
    try {
      const count = await publicClient.readContract({
        address: contractAddress!,
        abi: marketplaceAbi,
        functionName: "serviceCount",
      });
      const services = await Promise.all(
        Array.from({ length: Number(count) }, (_, i) =>
          publicClient.readContract({
            address: contractAddress!,
            abi: marketplaceAbi,
            functionName: "services",
            args: [BigInt(i)],
          }),
        ),
      );
      const next: Worker[] = [];
      services.forEach((s, i) => {
        if (!s[3]) return;
        try {
          const meta = JSON.parse(s[1]);
          next.push({
            id: `chain-${i}`,
            chainId: i,
            provider: s[0],
            name: String(meta.name || "AI worker"),
            subtitle: String(meta.subtitle || ""),
            description: String(meta.description || ""),
            category: categories.slice(1).includes(meta.category)
              ? meta.category
              : "Research",
            price: Number(formatEther(s[2])),
            priceWei: s[2].toString(),
            rating: s[5] ? Number(s[4]) / Number(s[5]) : 0,
            reviews: Number(s[5]),
            jobs: Number(s[5]),
            tags: Array.isArray(meta.tags)
              ? meta.tags.map(String).slice(0, 3)
              : ["New worker"],
            color: "sage",
            icon: "orbit",
          });
        } catch {}
      });
      setWorkers(next);
      const jobCount = await publicClient.readContract({
        address: contractAddress!,
        abi: marketplaceAbi,
        functionName: "jobCount",
      });
      const requests = await Promise.all(
        Array.from({ length: Number(jobCount) }, (_, i) =>
          publicClient.readContract({
            address: contractAddress!,
            abi: marketplaceAbi,
            functionName: "jobs",
            args: [BigInt(i)],
          }),
        ),
      );
      const requestEvents = await publicClient.getContractEvents({
        address: contractAddress!,
        abi: marketplaceAbi,
        eventName: "ServiceRequested",
        fromBlock: BigInt(
          process.env.NEXT_PUBLIC_MARKETPLACE_DEPLOYMENT_BLOCK || "0",
        ),
        toBlock: "latest",
      });
      setJobs(
        requests.flatMap((j, i) => {
          if (
            !walletAccount ||
            (j[1].toLowerCase() !== walletAccount.toLowerCase() &&
              j[2].toLowerCase() !== walletAccount.toLowerCase())
          )
            return [];
          const w = next.find((w) => w.chainId === Number(j[0]));
          return [
            {
              id: String(i),
              workerId: `chain-${j[0]}`,
              name: w?.name || `Service #${j[0]}`,
              category: w?.category || "Research",
              amount: Number(formatEther(j[3])),
              createdAt: Number(j[4]) * 1000,
              status: (["Paid", "Delivered", "Completed", "Refunded"] as const)[
                j[5]
              ],
              brief: j[6],
              result: j[7],
              buyer: j[1],
              provider: j[2],
              hash:
                requestEvents.find((event) => event.args.jobId === BigInt(i))
                  ?.transactionHash || undefined,
            },
          ];
        }),
      );
      if (walletAccount) {
        const balance = await publicClient.readContract({
          address: contractAddress!,
          abi: marketplaceAbi,
          functionName: "credits",
          args: [walletAccount],
        });
        setCredits(formatEther(balance));
      } else {
        setCredits("0");
      }
      setLoadError("");
    } catch {
      setLoadError(
        "Could not load the testnet marketplace. Check your RPC and contract configuration.",
      );
    } finally {
      setLoading(false);
    }
  }
  function humanError(e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return /reject|denied/i.test(message)
      ? "Transaction declined. You can try again when you’re ready."
      : message.slice(0, 250);
  }
  async function transact(
    action: (
      wallet: Awaited<ReturnType<typeof connectWallet>>["wallet"],
      account: `0x${string}`,
    ) => Promise<`0x${string}`>,
    success: string,
  ) {
    setTx({
      stage: "signing",
      message: "Confirm this transaction in your wallet…",
    });
    try {
      const connected = await connectWallet();
      if (connected.account.toLowerCase() !== account.toLowerCase())
        throw new Error("Wallet changed. Disconnect and sign in again.");
      const hash = await action(connected.wallet, connected.account);
      setTx({
        stage: "pending",
        message: "Transaction submitted. Waiting for confirmation…",
        hash,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success")
        throw new Error("Transaction reverted. No changes were made.");
      setTx({ stage: "success", message: success, hash });
      await refreshLive(connected.account);
      return receipt;
    } catch (e) {
      setTx({ stage: "error", message: humanError(e) });
    }
  }
  async function hire(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !brief.trim()) return;
    if (contractAddress && selected.chainId !== undefined) {
      const receipt = await transact(
        (wallet, account) =>
          wallet.writeContract({
            account,
            chain: botchain,
            address: contractAddress!,
            abi: marketplaceAbi,
            functionName: "requestService",
            args: [BigInt(selected.chainId!), brief.trim()],
            value: selected.priceWei
              ? BigInt(selected.priceWei)
              : parseEther(String(selected.price)),
          }),
        "BOT payment confirmed. Your request is in escrow.",
      );
      if (receipt) {
        setSelected(null);
        setBrief("");
        setView("My requests");
      }
    }
  }
  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name")).trim();
    const description = String(form.get("description")).trim();
    const price = Number(form.get("price"));
    if (!name || !description || !Number.isFinite(price) || price <= 0) {
      setTx({
        stage: "error",
        message: "Please enter a name, description, and a positive BOT price.",
      });
      return;
    }
    const metadata = {
      name,
      description,
      subtitle:
        String(form.get("subtitle")).trim() || "Your next autonomous teammate.",
      category: String(form.get("category")),
      tags: [String(form.get("category")), "New worker"],
    };
    if (contractAddress) {
      const receipt = await transact(
        (wallet, account) =>
          wallet.writeContract({
            account,
            chain: botchain,
            address: contractAddress!,
            abi: marketplaceAbi,
            functionName: "registerService",
            args: [JSON.stringify(metadata), parseEther(String(price))],
          }),
        "Worker registered on BOTChain Testnet.",
      );
      if (receipt) {
        setModal(null);
        setView("My workers");
      }
    }
  }
  async function updateJob(
    job: Job,
    action: "deliver" | "complete" | "refund",
  ) {
    if (!contractAddress) return;
    const receipt = await transact(
      (wallet, account) =>
        action === "deliver"
          ? wallet.writeContract({
              account,
              chain: botchain,
              address: contractAddress!,
              abi: marketplaceAbi,
              functionName: "deliverService",
              args: [BigInt(job.id), delivery.trim()],
            })
          : action === "complete"
            ? wallet.writeContract({
                account,
                chain: botchain,
                address: contractAddress!,
                abi: marketplaceAbi,
                functionName: "completeService",
                args: [BigInt(job.id), rating],
              })
            : wallet.writeContract({
                account,
                chain: botchain,
                address: contractAddress!,
                abi: marketplaceAbi,
                functionName: "refundService",
                args: [BigInt(job.id)],
              }),
      action === "deliver"
        ? "Delivery confirmed on-chain."
        : action === "complete"
          ? "Request completed. Provider can withdraw the BOT payment."
          : "Refund confirmed. Withdraw your BOT credit.",
    );
    if (receipt) {
      setResultJob(null);
      setDeliveryJob(null);
      setDelivery("");
    }
  }
  const filtered = useMemo(() => {
    let list = allWorkers.filter(
      (w) =>
        (category === "All workers" || w.category === category) &&
        (!onlyReviewed || w.reviews > 0) &&
        `${w.name} ${w.description} ${w.tags.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
    if (sort === "Price: low to high") list.sort((a, b) => a.price - b.price);
    if (sort === "Top rated") list.sort((a, b) => b.rating - a.rating);
    if (sort === "Most hired") list.sort((a, b) => b.jobs - a.jobs);
    return list;
  }, [allWorkers, category, onlyReviewed, search, sort]);
  const ownWorkers = allWorkers.filter(
    (w) => w.provider?.toLowerCase() === account?.toLowerCase(),
  );
  function navigate(v: View) {
    setView(v);
    setMobile(false);
    setSearch("");
  }
  function openWorker(w: Worker) {
    setSelected(w);
    setBrief("");
  }
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-backdrop" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a className="brand" href="/" aria-label="BitMarket home">
          <div className="brand-mark">
            <Layers3 size={25} />
          </div>
          <span>
            BitMarket<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <div className="workspace-icon">
            <Bot size={18} />
          </div>
          <div>
            <strong>Personal workspace</strong>
            <span>Your next big thing starts here</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {(
            [
              { label: "Marketplace", icon: LayoutGrid },
              { label: "My workers", icon: Bot },
              { label: "My requests", icon: ListOrdered },
              { label: "Transactions", icon: ArrowLeftRight },
            ] as const
          ).map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${view === label ? "active" : ""}`}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />
              {label}
              {label === "My requests" &&
                jobs.filter(
                  (j) => j.status === "Paid" || j.status === "Delivered",
                ).length > 0 && (
                  <span className="nav-count">
                    {
                      jobs.filter(
                        (j) => j.status === "Paid" || j.status === "Delivered",
                      ).length
                    }
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="nav-label resources-label">RESOURCES</div>
        <button className="nav-item" onClick={() => setModal("how")}>
          <BookOpen size={19} />
          How it works
          <ArrowUpRight className="nav-end" size={14} />
        </button>
        <button className="nav-item" onClick={() => setModal("help")}>
          <CircleHelp size={19} />
          Help & support
          <ArrowUpRight className="nav-end" size={14} />
        </button>
        <div className="sidebar-bottom">
          <div className="build-card">
            <div className="mini-spark">
              <Sparkles size={19} />
            </div>
            <strong>Built something brilliant?</strong>
            <p>
              Give your AI worker a home.
              <br />
              Let it work. Let it earn.
            </p>
            <button onClick={() => setModal("register")}>
              List a worker <ArrowUpRight size={16} />
            </button>
          </div>
          <a
            className="powered"
            href="https://dev-docs.botchain.ai/docs/Developers/quick-guide/"
            target="_blank"
            rel="noreferrer"
          >
            <span className="chain-logo">⛓</span> Powered by{" "}
            <strong>BOTChain</strong>
            <ArrowUpRight size={12} />
          </a>
          <div className="sidebar-user">
            <div className="user-avatar">Y</div>
            <div>
              <strong>Your workspace</strong>
              <span>{"Testnet account"}</span>
            </div>
            <button
              aria-label="Workspace information"
              onClick={() => setModal("help")}
            >
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <div className="top-actions">
            <span className="network">
              <i /> BOTChain Testnet
            </span>
            <span className="wallet-btn">
              <Wallet size={16} />
              {account.slice(0, 6)}…{account.slice(-4)}
            </span>
            <button
              className="wallet-btn"
              disabled={busy}
              onClick={onDisconnect}
            >
              <LogOut size={15} />
              Disconnect wallet
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> THE FUTURE OF WORK IS HERE
              </div>
              <h1>
                {view === "Marketplace"
                  ? "Meet your next teammate."
                  : view === "My workers"
                    ? "Your workers. Their potential."
                    : view === "My requests"
                      ? "Good work, in motion."
                      : "Every payment. In one place."}
              </h1>
              <p>
                {view === "Marketplace"
                  ? "A marketplace for autonomous workers."
                  : view === "My workers"
                    ? "Give your expertise a home. Put your workers to work."
                    : view === "My requests"
                      ? "Track your requests, review deliveries, and reward great work."
                      : "Transparent BOT payments, from request to completion."}
              </p>
            </div>
            <button
              className="primary list-button"
              onClick={() => setModal("register")}
            >
              <Plus size={17} />
              List a worker
            </button>
          </div>
          {view === "Marketplace" && (
            <>
              <section className="hero">
                <div className="hero-content">
                  <div className="hero-label">
                    <Sparkles size={14} /> BIG IDEAS. MEET GREAT WORKERS.
                  </div>
                  <h2>
                    Less busywork.
                    <br />
                    More <span>possibility.</span>
                  </h2>
                  <p>
                    From deep research to your next big launch.
                    <br />
                    Find specialized AI workers that get it done.
                  </p>
                  <button
                    onClick={() => {
                      document.getElementById("browse")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                      document.getElementById("worker-search")?.focus();
                    }}
                  >
                    Find your worker <ArrowUpRight size={17} />
                  </button>
                  {null}
                </div>
                <div className="orb-scene" aria-hidden="true">
                  <div className="orb-ring ring-one" />
                  <div className="orb-ring ring-two" />
                  <div className="orb-core">
                    <div className="orb-globe" />
                    <div className="orb-orbit" />
                    <Sparkles className="orb-spark" size={36} />
                  </div>
                  <span className="orbit-dot dot-one" />
                  <span className="orbit-dot dot-two" />
                  <div className="floating-label float-top">
                    <span className="status-dot" />
                    Autonomous. Always on.
                  </div>
                  <div className="floating-label float-bottom">
                    <Zap size={15} />
                    Made to get things done.
                  </div>
                  <span className="scene-star star-one">✦</span>
                  <span className="scene-star star-two">✧</span>
                  <span className="scene-star star-three">+</span>
                </div>
              </section>
              <section className="trust-strip">
                <div>
                  <ShieldCheck size={20} />
                  <span>
                    <strong>Secure by design</strong>
                    <small>Payments backed by BOTChain</small>
                  </span>
                </div>
                <div>
                  <Bot size={20} />
                  <span>
                    <strong>Specialists, not generalists</strong>
                    <small>The right worker for every task</small>
                  </span>
                </div>
                <div>
                  <Zap size={20} />
                  <span>
                    <strong>Work at the speed of thought</strong>
                    <small>Less waiting. More creating.</small>
                  </span>
                </div>
              </section>
              <section id="browse" className="market-section">
                <div className="section-title">
                  <div>
                    <h3>
                      Explore workers{" "}
                      <span>{"On-chain services, ready to hire."}</span>
                    </h3>
                  </div>
                  {null}
                </div>
                <div className="category-tabs">
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setCategory(c);
                        setLimit(6);
                      }}
                      className={category === c ? "selected" : ""}
                    >
                      {c === "All workers" && <LayoutGrid size={14} />} {c}
                    </button>
                  ))}
                </div>
                <div className="filter-row">
                  <label className="search-field">
                    <Search size={18} />
                    <input
                      id="worker-search"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setLimit(6);
                      }}
                      placeholder="Search for a worker, skill, or a little inspiration…"
                    />
                    {search && (
                      <button
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                    <kbd>⌘ K</kbd>
                  </label>
                  <button
                    className={`filter-btn ${onlyReviewed ? "enabled" : ""}`}
                    onClick={() => setOnlyReviewed(!onlyReviewed)}
                    aria-pressed={onlyReviewed}
                  >
                    <SlidersHorizontal size={16} />{" "}
                    {onlyReviewed ? "Reviewed only" : "Filters"}
                    {onlyReviewed && <span className="filter-dot" />}
                  </button>
                  <label className="sort-control">
                    <span>Sort by:</span>
                    <select
                      aria-label="Sort workers"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      {[
                        "Recommended",
                        "Top rated",
                        "Price: low to high",
                        "Most hired",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                </div>
                <div className="results-line">
                  <span>
                    <strong>{filtered.length}</strong> workers ready to help{" "}
                    {category !== "All workers" && `in ${category}`}
                  </span>
                  <span>
                    <i /> {"Native BOT payments · Testnet"}
                  </span>
                </div>
                {loadError && (
                  <div className="inline-error">
                    <AlertCircle size={17} />
                    {loadError}
                    <button onClick={() => refreshLive()}>Retry</button>
                  </div>
                )}
                <div className="worker-grid">
                  {filtered.slice(0, limit).map((worker) => (
                    <WorkerCard
                      key={worker.id}
                      worker={worker}
                      onClick={() => openWorker(worker)}
                    />
                  ))}
                </div>
                {loading && (
                  <div className="market-loading" role="status">
                    <LoaderCircle size={20} className="spin" />
                    Loading on-chain services…
                  </div>
                )}
                {!loading && !loadError && filtered.length === 0 && (
                  <Empty
                    icon={<Search size={28} />}
                    title="No workers found"
                    text={
                      "Register the first service on your testnet marketplace."
                    }
                    action={() => {
                      setSearch("");
                      setCategory("All workers");
                      setOnlyReviewed(false);
                    }}
                    label="Clear filters"
                  />
                )}
                {filtered.length > limit && (
                  <div className="load-more">
                    <button onClick={() => setLimit((l) => l + 6)}>
                      Discover more workers <ArrowRight size={16} />
                    </button>
                    <span>A whole world of possibility awaits.</span>
                  </div>
                )}
              </section>
              <section className="bottom-cta">
                <div className="cta-icon">
                  <Bot size={24} />
                </div>
                <div>
                  <h3>Your expertise. On autopilot.</h3>
                  <p>
                    Turn your AI agent into someone’s next favorite teammate.
                  </p>
                </div>
                <button onClick={() => setModal("register")}>
                  Start earning <ArrowUpRight size={16} />
                </button>
              </section>
            </>
          )}
          {view === "My workers" && (
            <>
              <div className="view-toolbar">
                <span>{ownWorkers.length} listed workers</span>
                {null}
              </div>
              {ownWorkers.length ? (
                <div className="worker-grid">
                  {ownWorkers.map((w) => (
                    <WorkerCard
                      worker={w}
                      key={w.id}
                      onClick={() => openWorker(w)}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={<Bot size={32} />}
                  title="Your next big thing starts here"
                  text="List a specialized AI worker, set a BOT price, and let people discover your service."
                  action={() => setModal("register")}
                  label="List your first worker"
                />
              )}
            </>
          )}
          {(view === "My requests" || view === "Transactions") && (
            <>
              <div className="view-toolbar">
                <span>{"BOTChain testnet workspace"}</span>
                {null}
              </div>
              <div className="request-stats">
                <div>
                  <small>Total requests</small>
                  <strong>{jobs.length}</strong>
                </div>
                <div>
                  <small>In progress</small>
                  <strong>
                    {
                      jobs.filter((j) =>
                        ["Paid", "Delivered"].includes(j.status),
                      ).length
                    }
                  </strong>
                </div>
                <div>
                  <small>Completed</small>
                  <strong>
                    {jobs.filter((j) => j.status === "Completed").length}
                  </strong>
                </div>
                <div>
                  <small>{"Escrow payments"}</small>
                  <strong>
                    {jobs
                      .filter((j) => j.status !== "Refunded")
                      .reduce((a, j) => a + j.amount, 0)
                      .toFixed(2)}{" "}
                    <span>BOT</span>
                  </strong>
                </div>
              </div>
              {loadError && (
                <div className="inline-error">
                  {loadError}
                  <button onClick={() => refreshLive()}>Retry</button>
                </div>
              )}
              {
                <div className="credit-bar">
                  <span>
                    Available withdrawal: <strong>{credits} BOT</strong>
                  </span>
                  <button
                    className="secondary"
                    disabled={busy || Number(credits) === 0}
                    onClick={() =>
                      contractAddress &&
                      transact(
                        (wallet, account) =>
                          wallet.writeContract({
                            account,
                            chain: botchain,
                            address: contractAddress!,
                            abi: marketplaceAbi,
                            functionName: "withdraw",
                          }),
                        "BOT credit withdrawn to your wallet.",
                      )
                    }
                  >
                    Withdraw BOT
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              }
              {jobs.length ? (
                <div className="jobs-list">
                  {jobs.map((job) => (
                    <article className="job-card" key={job.id}>
                      <div className="job-top">
                        <div className="job-identity">
                          <div className="job-icon">
                            <Bot size={21} />
                          </div>
                          <div>
                            <h3>{job.name}</h3>
                            <span>
                              {new Date(job.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}{" "}
                              · {job.category}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`status-badge ${job.status.toLowerCase()}`}
                        >
                          {job.status === "Paid"
                            ? "In progress"
                            : job.status === "Delivered"
                              ? "Ready for review"
                              : job.status}
                        </span>
                      </div>
                      <p>{job.brief}</p>
                      <div className="job-bottom">
                        <strong>
                          <BotCoin /> {job.amount} BOT{" "}
                          <small>
                            {job.status === "Completed"
                              ? "released"
                              : job.status === "Refunded"
                                ? "refunded"
                                : "in escrow"}
                          </small>
                        </strong>
                        <div className="job-actions">
                          {view === "My requests" &&
                            job.status === "Paid" &&
                            job.provider?.toLowerCase() ===
                              account?.toLowerCase() && (
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() => {
                                  setDeliveryJob(job);
                                  setDelivery("");
                                }}
                              >
                                <Sparkles size={14} />
                                Submit delivery
                              </button>
                            )}
                          {view === "My requests" &&
                            job.status === "Paid" &&
                            job.buyer?.toLowerCase() ===
                              account?.toLowerCase() &&
                            Date.now() >= job.createdAt + 7 * 86400000 && (
                              <button
                                className="text-btn"
                                disabled={busy}
                                onClick={() => updateJob(job, "refund")}
                              >
                                Refund
                              </button>
                            )}
                          {job.status === "Delivered" && (
                            <button
                              className="secondary"
                              onClick={() => {
                                setRating(5);
                                setResultJob(job);
                              }}
                            >
                              Review delivery
                              <ArrowUpRight size={14} />
                            </button>
                          )}
                          {job.status === "Completed" && (
                            <button
                              className="text-btn"
                              onClick={() => setResultJob(job)}
                            >
                              View result <CheckCircle2 size={14} />
                            </button>
                          )}
                          {
                            <a
                              href={
                                job.hash
                                  ? `https://scan.bohr.life/tx/${job.hash}`
                                  : `https://scan.bohr.life/address/${contractAddress}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="text-btn"
                            >
                              {job.hash ? "View payment" : "Contract events"}
                              <ExternalLink size={14} />
                            </a>
                          }
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={
                    view === "Transactions" ? (
                      <ArrowLeftRight size={30} />
                    ) : (
                      <ListOrdered size={30} />
                    )
                  }
                  title={
                    view === "Transactions"
                      ? "A clear view of every payment"
                      : "Meet your next teammate"
                  }
                  text={
                    !account
                      ? "Connect a wallet to view your testnet requests and BOT payment history."
                      : "Your requests and BOT payment history will appear here once you hire a worker."
                  }
                  action={() => navigate("Marketplace")}
                  label="Explore workers"
                />
              )}
            </>
          )}
          <footer>
            <span>
              © {new Date().getFullYear()} BitMarket. Built for what’s next.
            </span>
            <div>
              <span className="footer-live">
                <i />
                BOTChain Testnet
              </span>
              <button onClick={() => setModal("help")}>
                Help center
                <ArrowUpRight size={12} />
              </button>
            </div>
          </footer>
        </main>
      </div>
      {tx.stage !== "idle" && (
        <div
          className={`toast ${tx.stage}`}
          role={tx.stage === "error" ? "alert" : "status"}
        >
          {busy ? (
            <LoaderCircle className="spin" size={20} />
          ) : tx.stage === "error" ? (
            <AlertCircle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <div>
            <strong>
              {tx.stage === "signing"
                ? "Awaiting wallet"
                : tx.stage === "pending"
                  ? "Confirming transaction"
                  : tx.stage === "error"
                    ? "Action needs attention"
                    : "You’re all set"}
            </strong>
            <p>{tx.message}</p>
            {tx.hash && (
              <a
                href={`https://scan.bohr.life/tx/${tx.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction <ExternalLink size={12} />
              </a>
            )}
          </div>
          {!busy && (
            <button
              aria-label="Dismiss notification"
              onClick={() => setTx({ stage: "idle", message: "" })}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
      {(modal || selected || resultJob || deliveryJob) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) {
              setModal(null);
              setSelected(null);
              setResultJob(null);
              setDeliveryJob(null);
            }
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              selected
                ? selected.name
                : modal === "register"
                  ? "List a worker"
                  : resultJob
                    ? "Review delivery"
                    : "BitMarket information"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close dialog"
              disabled={busy}
              onClick={() => {
                setModal(null);
                setSelected(null);
                setResultJob(null);
                setDeliveryJob(null);
              }}
            >
              <X size={21} />
            </button>
            {selected && (
              <>
                <div className="profile-top">
                  <Avatar worker={selected} large />
                  <span className="category-label">{selected.category}</span>
                </div>
                <h2>{selected.name}</h2>
                <p className="profile-subtitle">{selected.subtitle}</p>
                <div className="profile-rating">
                  <Star size={16} fill="currentColor" />
                  {selected.reviews ? selected.rating.toFixed(1) : "New"}{" "}
                  <span>
                    ({selected.reviews} reviews) · {selected.jobs} jobs
                    completed
                  </span>
                </div>
                <p className="profile-description">{selected.description}</p>
                <div className="tags">
                  {selected.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <div className="profile-details">
                  <span>
                    <Clock3 size={15} /> {"Provider delivers off-chain"}
                  </span>
                  <span>
                    <ShieldCheck size={15} /> {"Native BOT escrow"}
                  </span>
                </div>
                <form onSubmit={hire}>
                  <label className="form-label" htmlFor="brief">
                    What would you like this worker to do?
                  </label>
                  <textarea
                    id="brief"
                    maxLength={1500}
                    required
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Describe your task, goals, and what a great result looks like…"
                    rows={4}
                  />
                  <div className="hire-summary">
                    <span>
                      Per request
                      <strong>
                        <BotCoin size={20} />
                        {selected.price} <small>BOT</small>
                      </strong>
                    </span>
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        !!(
                          account &&
                          selected.provider?.toLowerCase() ===
                            account.toLowerCase()
                        )
                      }
                      type="submit"
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={17} />
                      ) : (
                        <Wallet size={17} />
                      )}{" "}
                      {"Pay & request"}
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <p className="form-note">
                    {
                      "Testnet BOT is held in escrow until you accept delivery. Undelivered requests are refundable after 7 days. Briefs and results are public on-chain."
                    }
                  </p>
                </form>
              </>
            )}
            {modal === "register" && (
              <>
                <div className="modal-icon">
                  <Bot size={28} />
                </div>
                <div className="eyebrow">PUT YOUR EXPERTISE TO WORK</div>
                <h2>
                  Meet the next great worker.
                  <br />
                  Yours.
                </h2>
                <p className="modal-intro">
                  List a specialized AI service. Set a price. Find your people.
                </p>
                <form onSubmit={register}>
                  <div className="form-two">
                    <label>
                      Worker name
                      <input
                        name="name"
                        placeholder="e.g. Atlas Research"
                        maxLength={60}
                        required
                      />
                    </label>
                    <label>
                      Category
                      <select name="category">
                        {categories.slice(1).map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    One-line introduction
                    <input
                      name="subtitle"
                      placeholder="What makes your worker special?"
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Service description
                    <textarea
                      name="description"
                      placeholder="Describe what your worker does and what clients can expect."
                      maxLength={1200}
                      rows={3}
                      required
                    />
                  </label>
                  <div className="form-two">
                    <label>
                      Price per request (BOT)
                      <input
                        name="price"
                        type="number"
                        min="0.000001"
                        max="1000000"
                        step="0.000001"
                        placeholder="12"
                        required
                      />
                    </label>
                    <div className="registration-network">
                      <i />
                      {"BOTChain Testnet"}
                      <small>{"On-chain service registration"}</small>
                    </div>
                  </div>
                  <button
                    className="primary full-width"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Plus size={17} />
                    )}
                    List worker {"on testnet"}
                    <ArrowUpRight size={16} />
                  </button>
                  <p className="form-note">
                    Providers are responsible for fulfilling their services.{" "}
                    {
                      "Registration requires a wallet transaction. Metadata is public on-chain."
                    }
                  </p>
                </form>
              </>
            )}
            {deliveryJob && (
              <>
                <div className="modal-icon">
                  <Bot size={28} />
                </div>
                <h2>Deliver your work.</h2>
                <p className="modal-intro">
                  {deliveryJob.name} · Request #{deliveryJob.id}
                </p>
                <p className="profile-description">{deliveryJob.brief}</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (delivery.trim()) void updateJob(deliveryJob, "deliver");
                  }}
                >
                  <label className="form-label" htmlFor="delivery">
                    Delivery content or result URL
                  </label>
                  <div className="delivery-entry">
                    <textarea
                      id="delivery"
                      rows={6}
                      required
                      maxLength={1000}
                      value={delivery}
                      onChange={(e) => setDelivery(e.target.value)}
                      placeholder="Submit your completed work, or a link to the deliverable."
                    />
                  </div>
                  <button
                    className="primary full-width"
                    disabled={busy}
                    type="submit"
                  >
                    Submit delivery
                    <ArrowUpRight size={16} />
                  </button>
                  <p className="form-note">
                    Your delivery is recorded publicly on-chain. The buyer must
                    accept it to release payment.
                  </p>
                </form>
              </>
            )}
            {resultJob && (
              <>
                <div className="modal-icon">
                  <CheckCircle2 size={28} />
                </div>
                <h2>
                  {resultJob.status === "Completed"
                    ? "A job well done."
                    : "Your delivery is ready."}
                </h2>
                <p className="modal-intro">
                  {resultJob.name} · {resultJob.amount} BOT
                </p>
                <pre className="delivery-result">
                  {resultJob.result || "No delivery available."}
                </pre>
                {resultJob.status === "Delivered" &&
                  resultJob.buyer?.toLowerCase() === account?.toLowerCase() && (
                    <>
                      <label className="form-label">
                        How did this worker do?
                      </label>
                      <div className="rating-picker">
                        {[1, 2, 3, 4, 5].map((r) => (
                          <button
                            key={r}
                            aria-label={`Rate ${r} stars`}
                            onClick={() => setRating(r)}
                            className={r <= rating ? "rated" : ""}
                          >
                            <Star
                              size={27}
                              fill={r <= rating ? "currentColor" : "none"}
                            />
                          </button>
                        ))}
                        <span>{rating} / 5</span>
                      </div>
                      <button
                        className="primary full-width"
                        disabled={busy}
                        onClick={() => updateJob(resultJob, "complete")}
                      >
                        <Check size={17} />
                        Accept & complete
                      </button>
                      <p className="form-note">
                        {
                          "Accepting releases escrow to the provider’s withdrawal balance and records your rating on-chain."
                        }
                      </p>
                    </>
                  )}
              </>
            )}
            {modal === "how" && (
              <>
                <div className="modal-icon">
                  <Compass size={28} />
                </div>
                <h2>Great work starts here.</h2>
                <p className="modal-intro">
                  A marketplace for autonomous workers.
                </p>
                <div className="how-steps">
                  {[
                    {
                      title: "Find your specialist",
                      text: "Browse six categories, compare profiles, and find the right worker for your task.",
                    },
                    {
                      title: "Send a brief. Pay in BOT.",
                      text: "Describe the job. On testnet, native BOT is held safely in the marketplace escrow.",
                    },
                    {
                      title: "Review. Complete. Repeat.",
                      text: "The provider submits their delivery. Accept the work and leave a rating to release the payment.",
                    },
                  ].map((s, i) => (
                    <div key={s.title}>
                      <span>{i + 1}</span>
                      <section>
                        <h3>{s.title}</h3>
                        <p>{s.text}</p>
                      </section>
                    </div>
                  ))}
                </div>
                <p className="info-banner">
                  <Sparkles size={18} />
                  All listings, requests, payments, deliveries, and ratings are
                  read from BOTChain Testnet.
                </p>
                <button
                  className="primary full-width"
                  onClick={() => {
                    setModal(null);
                    navigate("Marketplace");
                  }}
                >
                  Find your worker
                  <ArrowRight size={17} />
                </button>
              </>
            )}
            {modal === "help" && (
              <>
                <div className="modal-icon">
                  <CircleHelp size={28} />
                </div>
                <h2>A little help along the way.</h2>
                <p className="modal-intro">
                  Everything you need to get started.
                </p>
                <div className="help-list">
                  <h3>Why do I need a wallet?</h3>
                  <p>
                    Wallet ownership is verified with a signed message before
                    you can access the app. Disconnecting ends your session. All
                    services and requests are stored on-chain.
                  </p>
                  <h3>How do testnet payments work?</h3>
                  <p>
                    Connect an EVM wallet and switch to BOTChain Testnet (968).
                    A deployed marketplace contract is required. Payment is
                    escrowed until you approve the delivery. Both providers and
                    buyers withdraw released credits.
                  </p>
                  <h3>What if a worker doesn’t deliver?</h3>
                  <p>
                    You can refund an undelivered testnet request after 7 days.
                    Once delivered, review and accept it to release payment.
                  </p>
                </div>
                <div className="help-links">
                  <a
                    href="https://faucet.botchain.ai"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get test BOT
                    <ArrowUpRight size={16} />
                  </a>
                  <a
                    href="https://dev-docs.botchain.ai/docs/Developers/quick-guide/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    BOTChain documentation
                    <ArrowUpRight size={16} />
                  </a>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function WorkerCard({
  worker,
  onClick,
}: {
  worker: Worker;
  onClick: () => void;
}) {
  return (
    <article className="worker-card">
      <div className="card-top">
        <Avatar worker={worker} />
        {worker.reviews > 0 ? (
          <span className="featured-badge">
            <Sparkles size={11} />
            Reviewed
          </span>
        ) : (
          <span className="available">
            <i />
            Available
          </span>
        )}
      </div>
      <button className="card-name" onClick={onClick}>
        <h4>{worker.name}</h4>
        <ArrowUpRight size={17} />
      </button>
      <div className="card-category">{worker.category}</div>
      <p className="card-subtitle">{worker.subtitle}</p>
      <div className="tags">
        {worker.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="card-reputation">
        <span>
          <Star size={13} fill="currentColor" />
          {worker.reviews ? worker.rating.toFixed(1) : "New"}{" "}
          <small>({worker.reviews})</small>
        </span>
        <span>
          <CheckCircle2 size={12} />
          {worker.jobs} jobs done
        </span>
      </div>
      <div className="card-bottom">
        <div>
          <small>Starting at</small>
          <strong>
            <BotCoin /> {worker.price} <span>BOT</span>
            <small>/ task</small>
          </strong>
        </div>
        <button onClick={onClick}>
          View worker
          <ArrowUpRight size={14} />
        </button>
      </div>
    </article>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action: () => void;
  label: string;
}) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary" onClick={action}>
        {label}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
