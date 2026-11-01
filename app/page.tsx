"use client";

import Link from "next/link";
import { PandaLogo } from "@/components/panda-logo";
import { Ticket, Wallet } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_75%_50%_at_50%_-15%,rgba(236,72,153,0.18),transparent_70%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="flex justify-center mb-6">
            <span className="flex size-16 items-center justify-center rounded-2xl border border-pink-500/30 bg-pink-500/15 shadow-[0_0_30px_rgba(236,72,153,0.2)]">
              <PandaLogo className="size-10" />
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-4">
            <span className="bg-gradient-to-r from-pink-300 to-pink-500 bg-clip-text text-transparent">
              Validus
            </span>
          </h1>
          <p className="text-lg text-zinc-400 mb-2">NFT Ticketing Platform</p>
          <p className="text-sm text-zinc-500 max-w-2xl mx-auto">
            Secure, transparent event ticketing on Sepolia testnet. Organizers create events, buyers purchase NFT tickets, and everyone benefits from anti-scalping protections.
          </p>
        </div>

        {/* Dashboard Links */}
        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Organizer Dashboard */}
          <Link
            href="/organizer"
            className="group rounded-3xl border border-white/10 bg-[#111116]/80 p-8 hover:border-pink-500/40 hover:shadow-xl hover:shadow-pink-950/20 transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="flex size-14 items-center justify-center rounded-xl bg-pink-500/10 text-pink-300 group-hover:bg-pink-500/20">
                <Ticket className="size-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold group-hover:text-pink-200">Organizer</h2>
                <p className="text-xs text-zinc-400">Create events</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 mb-6">
              Deploy on-chain events, manage ticket sales, track analytics, and earn royalties from secondary sales.
            </p>
            <span className="inline-flex items-center gap-2 text-pink-400 font-semibold text-sm">
              Go to dashboard →
            </span>
          </Link>

          {/* Buyer Dashboard */}
          <Link
            href="/buyer"
            className="group rounded-3xl border border-white/10 bg-[#111116]/80 p-8 hover:border-pink-500/40 hover:shadow-xl hover:shadow-pink-950/20 transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="flex size-14 items-center justify-center rounded-xl bg-pink-500/10 text-pink-300 group-hover:bg-pink-500/20">
                <Wallet className="size-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold group-hover:text-pink-200">Buyer</h2>
                <p className="text-xs text-zinc-400">Purchase tickets</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 mb-6">
              Browse upcoming events, purchase NFT tickets with Sepolia ETH, and manage your ticket collection.
            </p>
            <span className="inline-flex items-center gap-2 text-pink-400 font-semibold text-sm">
              Go to dashboard →
            </span>
          </Link>
        </div>

        {/* Footer Info */}
        <div className="mt-16 pt-16 border-t border-white/10 text-center text-xs text-zinc-500">
          <p>Connected to Sepolia Testnet</p>
          <p className="mt-1">Contract: <code className="font-mono text-zinc-400">0xa64e9ed54034bd804c878844ce838153ecc796aa</code></p>
        </div>
      </div>
    </main>
  );
}
