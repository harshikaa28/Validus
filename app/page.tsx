"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Coins,
  Copy,
  Cpu,
  ExternalLink,
  Maximize2,
  Minimize2,
  PanelRight,
  PanelRightClose,
  RefreshCw,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  Terminal,
  Ticket,
  Wallet,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { PandaLogo } from "@/components/panda-logo";
import { CursorGlitter } from "@/components/cursor-glitter";
import { cn } from "@/lib/utils";

type Step = { tool: string; args: unknown; result: any; error?: boolean };
type Message = { role: "user" | "agent"; text: string; steps?: Step[]; error?: boolean };
type Status = { hasApiKey: boolean; model: string; tools: { name: string; description: string }[] };
type WalletInfo = { address: string | null; balance?: string };

const EXAMPLES = [
  {
    title: "Verify Authentic Ticket",
    prompt: "Verify ticket TKT-001",
    tag: "Authenticity",
  },
  {
    title: "Check Fair Resale Price",
    prompt: "Check if ₹7,500 is allowed for a ₹5,000 Coldplay ticket",
    tag: "Price Cap",
  },
  {
    title: "Detect Fraudulent Pass",
    prompt: "Verify ticket FAKE-666",
    tag: "Fraud Check",
  },
  {
    title: "Inspect Agent Wallet",
    prompt: "What's in your wallet?",
    tag: "On-Chain",
  },
  {
    title: "Overpriced Resale Check",
    prompt: "Check if ₹9,000 is allowed for a ₹5,000 ticket",
    tag: "Enforcement",
  },
  {
    title: "Test Paid Weather API",
    prompt: "What's the weather in Mumbai?",
    tag: "Micro-payment",
  },
];

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshingWallet, setRefreshingWallet] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showToolsSidebar, setShowToolsSidebar] = useState(false);
  const [showContainedTools, setShowContainedTools] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const loadWallet = async () => {
    setRefreshingWallet(true);
    try {
      const res = await fetch("/api/wallet");
      const data = await res.json();
      setWallet(data);
    } catch (e) {
      console.error("Failed to load wallet", e);
    } finally {
      setRefreshingWallet(false);
    }
  };

  useEffect(() => {
    fetch("/api/agent")
      .then((r) => r.json())
      .then(setStatus)
      .catch((e) => console.error("Failed to load agent status", e));
    loadWallet();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Handle ESC key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  async function createWallet() {
    setCreating(true);
    try {
      await fetch("/api/wallet", { method: "POST" });
      await loadWallet();
    } catch (e) {
      console.error("Failed to create wallet", e);
    } finally {
      setCreating(false);
    }
  }

  async function send(text: string) {
    if (!text.trim() || thinking) return;
    const history: Message[] = [...messages, { role: "user", text }];
    setMessages(history);
    setInput("");
    setThinking(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((m) => !m.error).map(({ role, text }) => ({ role, text })),
        }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        data.error
          ? { role: "agent", text: data.error, error: true }
          : { role: "agent", text: data.answer, steps: data.steps },
      ]);
      if (data.steps?.some((s: Step) => s.result?.payment)) {
        loadWallet();
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: "Could not reach the server. Is `npm run dev` still running?",
          error: true,
        },
      ]);
    }
    setThinking(false);
  }

  const ready = Boolean(status?.hasApiKey);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-pink-500 selection:text-white flex flex-col">
      {/* Subtle cursor glitter effect following the mouse */}
      <CursorGlitter />

      {/* ─── Top Header ─── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-zinc-950/80 px-4 py-3 backdrop-blur-md md:px-8 transition-colors">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          {/* Cute Panda Logo & Brand Title */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 p-1 ring-1 ring-pink-500/30 shadow-md shadow-pink-500/20 group hover:bg-pink-500/20 transition-all duration-300">
              <PandaLogo className="size-8 animate-panda-float" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-[#f472b6] to-[#ec4899] bg-clip-text text-transparent md:text-xl font-heading">
                  Validus
                </span>
                <span className="text-xs font-semibold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                  Agent
                </span>
                {status && (
                  <Badge
                    variant="outline"
                    className="hidden sm:inline-flex border-white/10 bg-white/[0.03] text-[11px] text-zinc-300 font-mono"
                  >
                    <span className="mr-1.5 size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    {status.model || "Gemini"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Top-Right Header: Wallet Component */}
          <div className="flex items-center gap-2.5">
            <HeaderWallet
              wallet={wallet}
              onRefresh={loadWallet}
              onCreateWallet={createWallet}
              creating={creating}
              refreshing={refreshingWallet}
            />
          </div>
        </div>
      </header>

      {/* ─── Main Content (Hero + Contained Agent Box) ─── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8 flex flex-col">
        {/* ─── Hero Section ─── */}
        <section className="text-center max-w-3xl mx-auto mb-8 animate-soft-fade-in">
          {/* Subtle Pink Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-pink-500/25 bg-pink-500/10 text-pink-400 text-xs font-medium mb-3.5 shadow-sm shadow-pink-500/10 hover:border-pink-500/40 transition-colors">
            <Sparkles className="size-3.5 text-pink-400" />
            <span>Fair Ticketing & Anti-Scalping Protocol</span>
          </div>

          {/* Heading with soft pink gradient */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-4 bg-gradient-to-r from-[#f472b6] via-pink-400 to-[#ec4899] bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(244,114,182,0.25)] select-none font-heading">
            Validus
          </h1>

          {/* 4–5 Line Description */}
          <p className="text-sm md:text-base text-zinc-300 leading-relaxed font-normal text-balance">
            Validus is an intelligent on-chain agent dedicated to restoring integrity to live event ticketing.
            It instantly verifies passes against cryptographic registry data to protect fans from fake tickets and fraudulent barcodes.
            The agent autonomously detects and flags predatory scalpers before they can exploit high-demand concerts.
            By enforcing strict 1.5× price caps on secondary transfers, Validus guarantees fair resale prices so genuine fans never overpay.
          </p>

          {/* Feature Highlights Pills */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/60 px-3 py-1.5 text-zinc-300 shadow-sm transition-all hover:border-pink-500/40 hover:-translate-y-0.5">
              <span className="size-1.5 rounded-full bg-pink-400" />
              Verify Authentic Passes
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/60 px-3 py-1.5 text-zinc-300 shadow-sm transition-all hover:border-pink-500/40 hover:-translate-y-0.5">
              <span className="size-1.5 rounded-full bg-pink-400" />
              Flag Counterfeits & Scalpers
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/60 px-3 py-1.5 text-zinc-300 shadow-sm transition-all hover:border-pink-500/40 hover:-translate-y-0.5">
              <span className="size-1.5 rounded-full bg-pink-400" />
              1.5× Fair Resale Cap
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/60 px-3 py-1.5 text-zinc-300 shadow-sm transition-all hover:border-pink-500/40 hover:-translate-y-0.5">
              <span className="size-1.5 rounded-full bg-pink-400" />
              Base Sepolia Micropayments
            </span>
          </div>
        </section>

        {/* ─── Contained Agent Box ─── */}
        <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col mb-8">
          <div className="relative rounded-2xl border border-white/[0.1] bg-zinc-950/70 shadow-2xl backdrop-blur-xl flex flex-col h-[560px] md:h-[600px] overflow-hidden transition-all duration-300">
            {/* Agent Box Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-zinc-900/50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg bg-pink-500/10 p-0.5 ring-1 ring-pink-500/25">
                  <PandaLogo className="size-5" />
                </div>
                <span className="text-sm font-semibold tracking-wide text-zinc-200">
                  Agent Console
                </span>
                <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                  {messages.length} {messages.length === 1 ? "turn" : "turns"}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                {/* Tools Toggle Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowContainedTools(!showContainedTools)}
                  className={cn(
                    "h-8 rounded-lg px-2 text-xs font-medium text-zinc-400 hover:bg-pink-500/10 hover:text-pink-300 transition-colors",
                    showContainedTools && "bg-pink-500/15 text-pink-300 border border-pink-500/30"
                  )}
                  title="Toggle registered tools"
                >
                  <Wrench className="size-3.5 mr-1" />
                  <span className="hidden sm:inline">Tools</span> ({status?.tools.length ?? 0})
                </Button>

                {/* Clear Chat Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMessages([])}
                  disabled={messages.length === 0 || thinking}
                  className="h-8 rounded-lg px-2 text-xs font-medium text-zinc-400 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30 transition-colors"
                  title="Clear conversation"
                >
                  <RotateCcw className="size-3.5 mr-1" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>

                {/* Full Screen Expand Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullScreen(true)}
                  className="h-8 rounded-lg border-pink-500/30 bg-pink-500/10 px-2.5 text-xs font-semibold text-pink-300 hover:border-pink-500/60 hover:bg-pink-500/20 hover:text-white transition-all shadow-sm"
                  title="Expand to Full Screen"
                >
                  <Maximize2 className="size-3.5 mr-1" />
                  <span>Full Screen</span>
                </Button>
              </div>
            </div>

            {/* Contained Tools Collapsible Drawer */}
            {showContainedTools && (
              <div className="shrink-0 border-b border-white/[0.08] bg-zinc-900/90 p-3 max-h-48 overflow-y-auto animate-soft-fade-in text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Terminal className="size-3.5 text-pink-400" /> Active Agent Tools
                  </span>
                  <span className="font-mono text-[10px] text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                    {status?.tools.length ?? 0} Available
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {status?.tools.map((t) => (
                    <div
                      key={t.name}
                      className="rounded-lg border border-white/[0.06] bg-zinc-950/60 p-2 hover:border-pink-500/30 transition-colors"
                    >
                      <div className="font-mono font-semibold text-pink-400 text-[11px]">
                        {t.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 leading-tight mt-0.5">
                        {t.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scrollable Messages Area */}
            <div
              ref={chatScrollRef}
              className="flex-1 min-h-0 overflow-y-auto px-4 py-5 md:px-6 space-y-5 scroll-smooth"
            >
              {/* Empty State */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center animate-soft-fade-in">
                  <div className="relative mb-3">
                    <div className="absolute -inset-2 rounded-full bg-pink-500/15 blur-lg" />
                    <div className="relative flex size-14 items-center justify-center rounded-2xl bg-zinc-900/90 border border-pink-500/30 p-2 shadow-lg shadow-pink-500/10">
                      <PandaLogo className="size-10 animate-panda-float" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold tracking-tight text-white">
                    How can Validus help today?
                  </h3>
                  <p className="mt-1 max-w-md text-xs text-zinc-400">
                    Ask me to check a ticket pass ID, verify pricing limits, or review agent wallet activity.
                  </p>

                  {!ready && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
                      <CircleAlert className="size-4 shrink-0 text-amber-400" />
                      <span>
                        Add <code className="font-mono text-white">GEMINI_API_KEY</code> to{" "}
                        <code className="font-mono text-white">.env</code> to activate agent responses.
                      </span>
                    </div>
                  )}

                  {/* Quick Prompts Grid */}
                  <div className="mt-6 w-full">
                    <div className="mb-2.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      <Sparkles className="size-3 text-pink-400" />
                      <span>Suggested prompts</span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex.prompt}
                          onClick={() => send(ex.prompt)}
                          disabled={!ready || thinking}
                          className="group flex flex-col items-start gap-1 rounded-xl border border-white/[0.08] bg-zinc-900/50 p-2.5 text-left transition-all hover:border-pink-500/50 hover:bg-pink-500/[0.08] hover:-translate-y-0.5 hover:shadow-md hover:shadow-pink-500/10 disabled:opacity-50"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-medium text-pink-400 border border-pink-500/20">
                              {ex.tag}
                            </span>
                            <ChevronRight className="size-3 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-pink-400" />
                          </div>
                          <span className="font-medium text-zinc-200 text-xs group-hover:text-white mt-0.5">
                            {ex.title}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400 line-clamp-1">
                            &quot;{ex.prompt}&quot;
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Message Stream */}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end animate-soft-fade-in">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-pink-500/20 md:max-w-[75%] md:px-4.5 md:py-2.5">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex max-w-[92%] items-start gap-2.5 md:max-w-[85%] animate-soft-fade-in">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 p-0.5 ring-1 ring-pink-500/30">
                      <PandaLogo className="size-5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {/* Render tool steps */}
                      {m.steps?.map((s, j) => (
                        <ToolCall key={j} step={s} />
                      ))}

                      {/* Agent text message bubble */}
                      <div
                        className={cn(
                          "rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-sm md:px-4 md:py-3 whitespace-pre-wrap leading-relaxed shadow-sm",
                          m.error
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                            : "border-white/[0.08] bg-zinc-900/80 text-zinc-100"
                        )}
                      >
                        {m.error && (
                          <div className="flex items-center gap-1.5 font-semibold text-rose-400 mb-1 text-xs uppercase tracking-wider">
                            <CircleAlert className="size-3.5 shrink-0" />
                            <span>Error occurred</span>
                          </div>
                        )}
                        {m.text}
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Thinking Indicator */}
              {thinking && (
                <div className="flex items-center gap-2.5 animate-soft-fade-in">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 p-0.5 ring-1 ring-pink-500/30">
                    <PandaLogo className="size-5 animate-panda-float" />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-900/80 px-3 py-1.5 text-xs font-mono text-zinc-300">
                    <span className="size-2 rounded-full bg-pink-500 animate-ping" />
                    <span>Validus Agent is processing...</span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input Bar */}
            <div className="shrink-0 border-t border-white/[0.08] bg-zinc-950/90 p-3 backdrop-blur-md">
              <form
                className="flex w-full items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <div
                  className={cn(
                    "flex flex-1 items-center rounded-xl border border-white/[0.1] bg-zinc-900/70 px-3 py-0.5 transition-all focus-within:border-pink-500/70 focus-within:ring-2 focus-within:ring-pink-500/20",
                    !ready && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <span className="flex items-center gap-1 font-mono text-xs text-pink-400 pr-2 select-none">
                    <Terminal className="size-3.5" />
                    <span>prompt $</span>
                  </span>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      ready
                        ? "Verify ticket (e.g. TKT-001) or check resale price..."
                        : "Add Gemini API key in .env to start"
                    }
                    disabled={!ready || thinking}
                    className="h-9 border-0 bg-transparent px-1 font-mono text-xs md:text-sm text-white placeholder:text-zinc-500 focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!ready || thinking || !input.trim()}
                  className="h-10 rounded-xl bg-pink-500 px-4 text-white shadow-md shadow-pink-500/25 transition-all hover:bg-pink-600 active:scale-95 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <SendHorizontal className="size-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* ─── Compact Bottom System Status ─── */}
        <section className="max-w-4xl mx-auto w-full mb-6">
          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/40 p-4 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
            <div className="flex items-center gap-2.5">
              <span className="flex size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="font-medium text-zinc-300">Validus Protection Suite Active</span>
              <span className="text-zinc-600">|</span>
              <span className="font-mono text-[11px] text-pink-400">
                {status?.tools.length ?? 0} Tools Registered
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span>Base Sepolia Testnet</span>
              <span className="text-zinc-600">•</span>
              <span>Gemini 2.5 Flash</span>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Full Screen Agent Chat Modal ─── */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-2xl p-2 sm:p-4 md:p-6 animate-soft-fade-in">
          {/* Full Screen Header */}
          <div className="mx-auto flex w-full max-w-7xl shrink-0 items-center justify-between border-b border-white/[0.1] bg-zinc-900/60 rounded-t-2xl px-4 py-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-pink-500/10 p-1 ring-1 ring-pink-500/30">
                <PandaLogo className="size-7 animate-panda-float" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold bg-gradient-to-r from-[#f472b6] to-[#ec4899] bg-clip-text text-transparent md:text-lg font-heading">
                    Validus Console
                  </span>
                  <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-[10px] font-mono">
                    Full Screen
                  </Badge>
                  <span className="hidden sm:inline-block rounded-full bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                    {messages.length} {messages.length === 1 ? "turn" : "turns"}
                  </span>
                </div>
              </div>
            </div>

            {/* Full Screen Controls */}
            <div className="flex items-center gap-2">
              {/* Toggle Sidebar in Full Screen */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowToolsSidebar(!showToolsSidebar)}
                className={cn(
                  "hidden lg:inline-flex rounded-xl border-white/10 bg-white/[0.03] text-xs font-medium text-zinc-300 hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-white transition-colors",
                  showToolsSidebar && "border-pink-500/30 bg-pink-500/10 text-pink-300"
                )}
                title={showToolsSidebar ? "Hide Tools" : "Show Tools"}
              >
                {showToolsSidebar ? (
                  <>
                    <PanelRightClose className="size-3.5 mr-1.5" />
                    Hide Tools
                  </>
                ) : (
                  <>
                    <PanelRight className="size-3.5 mr-1.5" />
                    Tools ({status?.tools.length ?? 0})
                  </>
                )}
              </Button>

              {/* Clear Messages */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMessages([])}
                disabled={messages.length === 0 || thinking}
                className="h-8 rounded-lg px-2.5 text-xs font-medium text-zinc-400 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30"
              >
                <RotateCcw className="size-3.5 mr-1" />
                <span className="hidden sm:inline">Clear</span>
              </Button>

              {/* Exit Full Screen Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullScreen(false)}
                className="h-8 rounded-xl border-pink-500/40 bg-pink-500/15 px-3 text-xs font-semibold text-pink-300 hover:border-pink-500/70 hover:bg-pink-500/30 hover:text-white transition-all shadow-md"
                title="Exit Full Screen (Esc)"
              >
                <Minimize2 className="size-3.5 mr-1.5" />
                <span>Exit Full Screen</span>
                <kbd className="ml-1.5 hidden rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-400 md:inline-block">
                  Esc
                </kbd>
              </Button>
            </div>
          </div>

          {/* Full Screen Main Chat & Sidebar Body */}
          <div className="mx-auto flex w-full max-w-7xl flex-1 min-h-0 gap-4 overflow-hidden rounded-b-2xl border-x border-b border-white/[0.1] bg-zinc-950/80 p-3 sm:p-4">
            {/* Chat Panel */}
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/40">
              {/* Messages Area */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 md:px-8 space-y-5 scroll-smooth">
                {messages.length === 0 && (
                  <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-12 text-center animate-soft-fade-in">
                    <div className="relative mb-4">
                      <div className="absolute -inset-3 rounded-full bg-pink-500/20 blur-xl" />
                      <div className="relative flex size-16 items-center justify-center rounded-2xl bg-zinc-900/90 border border-pink-500/30 p-2 shadow-xl shadow-pink-500/20">
                        <PandaLogo className="size-12 animate-panda-float" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">
                      Validus AI Agent (Full Screen)
                    </h2>
                    <p className="mt-2 max-w-md text-sm text-zinc-400">
                      Verify tickets, check resale limits, or ask questions with maximum visibility.
                    </p>

                    <div className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 w-full">
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex.prompt}
                          onClick={() => send(ex.prompt)}
                          disabled={!ready || thinking}
                          className="group flex flex-col items-start gap-1 rounded-xl border border-white/[0.08] bg-zinc-900/50 p-3 text-left transition-all hover:border-pink-500/50 hover:bg-pink-500/[0.08] hover:shadow-lg hover:shadow-pink-500/10 disabled:opacity-50"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-medium text-pink-400 border border-pink-500/20">
                              {ex.tag}
                            </span>
                            <ChevronRight className="size-3.5 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-pink-400" />
                          </div>
                          <span className="font-medium text-zinc-200 text-xs group-hover:text-white mt-1">
                            {ex.title}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400 line-clamp-1">
                            &quot;{ex.prompt}&quot;
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end animate-soft-fade-in">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-pink-500/20 md:max-w-[70%] md:text-base">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex max-w-[92%] items-start gap-3 md:max-w-[85%] animate-soft-fade-in">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 p-1 ring-1 ring-pink-500/30">
                        <PandaLogo className="size-6" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                        {m.steps?.map((s, j) => (
                          <ToolCall key={j} step={s} />
                        ))}
                        <div
                          className={cn(
                            "rounded-2xl rounded-tl-sm border px-4 py-3 text-sm md:text-base whitespace-pre-wrap leading-relaxed shadow-sm",
                            m.error
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                              : "border-white/[0.08] bg-zinc-900/80 text-zinc-100"
                          )}
                        >
                          {m.error && (
                            <div className="flex items-center gap-1.5 font-semibold text-rose-400 mb-1 text-xs uppercase tracking-wider">
                              <CircleAlert className="size-4 shrink-0" />
                              <span>Error occurred</span>
                            </div>
                          )}
                          {m.text}
                        </div>
                      </div>
                    </div>
                  )
                )}

                {thinking && (
                  <div className="flex items-center gap-3 animate-soft-fade-in">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 p-1 ring-1 ring-pink-500/30">
                      <PandaLogo className="size-6 animate-panda-float" />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-zinc-900/80 px-4 py-2 text-xs font-mono text-zinc-300">
                      <span className="size-2 rounded-full bg-pink-500 animate-ping" />
                      <span>Validus Agent is processing...</span>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Full Screen Input Bar */}
              <div className="shrink-0 border-t border-white/[0.08] bg-zinc-950/90 p-3.5 backdrop-blur-md">
                <form
                  className="flex w-full items-center gap-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                >
                  <div
                    className={cn(
                      "flex flex-1 items-center rounded-xl border border-white/[0.1] bg-zinc-900/70 px-3.5 py-1 transition-all focus-within:border-pink-500/70 focus-within:ring-2 focus-within:ring-pink-500/20",
                      !ready && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <span className="flex items-center gap-1 font-mono text-xs text-pink-400 pr-2 select-none">
                      <Terminal className="size-3.5" />
                      <span>prompt $</span>
                    </span>
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        ready
                          ? "Ask to verify a ticket (e.g. TKT-001) or check resale price..."
                          : "Add Gemini API key in .env to start chatting"
                      }
                      disabled={!ready || thinking}
                      className="h-10 border-0 bg-transparent px-2 font-mono text-xs md:text-sm text-white placeholder:text-zinc-500 focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={!ready || thinking || !input.trim()}
                    className="h-11 rounded-xl bg-pink-500 px-5 text-white shadow-lg shadow-pink-500/25 transition-all hover:bg-pink-600 active:scale-95 disabled:opacity-40"
                    aria-label="Send message"
                  >
                    <SendHorizontal className="size-4" />
                  </Button>
                </form>
              </div>
            </div>

            {/* Optional Full Screen Tools Sidebar */}
            {showToolsSidebar && (
              <aside className="hidden w-[310px] shrink-0 flex-col gap-4 overflow-y-auto lg:flex animate-soft-fade-in">
                {/* System Setup Overview Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-4 shadow-xl backdrop-blur-xl">
                  <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      <Cpu className="size-3.5 text-pink-400" /> System Setup
                    </span>
                    <Badge
                      variant={ready ? "default" : "destructive"}
                      className="rounded-full text-[10px] uppercase font-mono px-2 py-0"
                    >
                      {ready ? "Operational" : "Key Needed"}
                    </Badge>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold font-mono mt-0.5",
                          ready ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                        )}
                      >
                        {ready ? <Check className="size-3" /> : "1"}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-200">Gemini 2.5 API</p>
                        <p className="text-zinc-400 text-[11px] mt-0.5">
                          {ready ? "Connected via .env" : "API key required"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold font-mono mt-0.5",
                          wallet?.address ? "bg-emerald-500/20 text-emerald-400" : "bg-pink-500/20 text-pink-400"
                        )}
                      >
                        {wallet?.address ? <Check className="size-3" /> : "2"}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-zinc-200">Agent Wallet</p>
                        <p className="text-zinc-400 text-[11px] mt-0.5">
                          {wallet?.address ? (
                            "Configured on Base Sepolia"
                          ) : (
                            <button
                              onClick={createWallet}
                              disabled={creating}
                              className="text-pink-400 hover:underline"
                            >
                              {creating ? "Creating..." : "Initialize wallet"}
                            </button>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Registered Tools Card */}
                <div className="flex-1 rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-4 shadow-xl backdrop-blur-xl">
                  <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      <Terminal className="size-3.5 text-pink-400" /> Registered Tools
                    </span>
                    <span className="font-mono text-[11px] text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                      {status?.tools.length ?? 0} active
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {status?.tools.map((t) => (
                      <div
                        key={t.name}
                        className="rounded-xl border border-white/[0.06] bg-zinc-950/50 p-2.5 transition-colors hover:border-pink-500/30"
                      >
                        <div className="flex items-center gap-1.5 font-mono font-semibold text-pink-400">
                          <span className="size-1.5 rounded-full bg-pink-500" />
                          <span>{t.name}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-400 leading-normal">
                          {t.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

{/* ─── Top-Right Header Wallet Component ─── */}
function HeaderWallet({
  wallet,
  onRefresh,
  onCreateWallet,
  creating,
  refreshing,
}: {
  wallet: WalletInfo | null;
  onRefresh: () => void;
  onCreateWallet: () => void;
  creating: boolean;
  refreshing: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!wallet) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-900/60 px-3 text-xs text-zinc-400">
        <RefreshCw className="size-3 animate-spin text-pink-400" />
        <span>Loading wallet...</span>
      </div>
    );
  }

  if (!wallet.address) {
    return (
      <Button
        onClick={onCreateWallet}
        disabled={creating}
        size="sm"
        className="rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-mono text-xs shadow-md shadow-pink-500/20 transition-all active:scale-95"
      >
        <Wallet className="size-3.5 mr-1.5" />
        {creating ? "Creating..." : "Create Wallet"}
      </Button>
    );
  }

  const address = wallet.address;
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  function copyAddress() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-zinc-900/80 px-2.5 py-1.5 shadow-sm backdrop-blur-md">
      {/* Network & Balance */}
      <div className="flex items-center gap-2 border-r border-white/[0.1] pr-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span className="hidden font-mono text-[11px] font-medium text-zinc-400 sm:inline">
            Base Sepolia
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-xs font-semibold text-white">
          <Coins className="size-3 text-pink-400" />
          <span>{wallet.balance ?? "0 ETH"}</span>
        </div>
      </div>

      {/* Address & Actions */}
      <div className="flex items-center gap-1 pl-0.5">
        <code
          className="font-mono text-xs text-pink-400 font-medium cursor-pointer hover:underline"
          onClick={copyAddress}
          title={address}
        >
          {shortAddress}
        </code>

        {/* Copy Button */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={copyAddress}
          className="rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
          aria-label="Copy address"
          title={copied ? "Copied!" : "Copy address"}
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
        </Button>

        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
          aria-label="Refresh balance"
          title="Refresh balance"
        >
          <RefreshCw className={cn("size-3", refreshing && "animate-spin text-pink-400")} />
        </Button>

        {/* Explorer Link */}
        <a
          href={`https://sepolia.basescan.org/address/${address}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex size-6 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-pink-400"
          aria-label="View on Basescan Explorer"
          title="View on Basescan Explorer"
        >
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

{/* ─── Tool Call Visualization Component ─── */}
function ToolCall({ step }: { step: Step }) {
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const payment = step.result?.payment;

  return (
    <Collapsible className="overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/70 font-mono text-xs shadow-sm">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.04]">
        <ChevronRight className="size-3.5 text-zinc-400 transition-transform group-data-[panel-open]:rotate-90" />
        <span className="text-[11px] uppercase tracking-wider text-zinc-400">Tool</span>
        <span className="font-semibold text-pink-400">{step.tool}</span>

        {payment && (
          <Badge className="ml-auto rounded-full bg-blue text-white uppercase text-[10px] px-2 py-0 border-0">
            Paid {payment.amount}
          </Badge>
        )}
        {step.error && (
          <Badge variant="destructive" className="ml-auto rounded-full uppercase text-[10px] px-2 py-0">
            Failed
          </Badge>
        )}
        {!payment && !step.error && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-400">
            <Check className="size-3" /> Success
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="flex flex-col gap-2.5 border-t border-white/[0.06] bg-zinc-950/60 px-3.5 py-3">
        {/* Input parameters */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-400">
            <span>Input Arguments</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(step.args, null, 2));
                setCopiedInput(true);
                setTimeout(() => setCopiedInput(false), 1500);
              }}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {copiedInput ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-white/[0.05] bg-zinc-900/90 p-2.5 text-[11px] text-zinc-300">
            {JSON.stringify(step.args, null, 2)}
          </pre>
        </div>

        {/* Output result */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-400">
            <span>Result Output</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(step.result, null, 2));
                setCopiedOutput(true);
                setTimeout(() => setCopiedOutput(false), 1500);
              }}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {copiedOutput ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-white/[0.05] bg-zinc-900/90 p-2.5 text-[11px] text-zinc-300">
            {JSON.stringify(step.result, null, 2)}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
