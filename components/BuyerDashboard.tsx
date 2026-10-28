"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  MapPin,
  RefreshCw,
  Ticket,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { PandaLogo } from "@/components/panda-logo";
import {
  DEFAULT_CONTRACT_ADDRESS,
  getConfiguredContractAddress,
  getSepoliaProvider,
  SEPOLIA_RPC_URLS,
} from "@/lib/sepolia";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const SEPOLIA_CHAIN_ID = 11155111n;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
const EVENT_EXPLORER_URL = "https://sepolia.etherscan.io";
const MAX_EVENT_ID_SCAN = 1_000;

// ABI for ValidusTicket @ 0xd9c393e7311e1667f0ea8c5c428b2a898247af54 (Sepolia)
// Object-form ABI — field names match the deployed contract exactly.
const BUYER_ABI = [
  // getEventDetails — returns the Event struct
  {
    inputs: [{ internalType: "uint256", name: "eventId", type: "uint256" }],
    name: "getEventDetails",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "eventId",      type: "uint256" },
          { internalType: "string",  name: "name",         type: "string"  },
          { internalType: "string",  name: "location",     type: "string"  },
          { internalType: "uint256", name: "eventDate",    type: "uint256" },
          { internalType: "address", name: "organizer",    type: "address" },
          { internalType: "uint256", name: "ticketPrice",  type: "uint256" },
          { internalType: "uint256", name: "totalTickets", type: "uint256" },
          { internalType: "uint256", name: "ticketsSold",  type: "uint256" },
          { internalType: "bool",    name: "active",       type: "bool"    },
        ],
        internalType: "struct ValidusTicket.Event",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // totalEvents — total number of events created
  {
    inputs: [],
    name: "totalEvents",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // buyTicket — secondary-market purchase of a listed NFT ticket
  {
    inputs: [{ internalType: "uint256", name: "tokenID", type: "uint256" }],
    name: "buyTicket",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  // balanceOf — ERC-721 token count for an address
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // getTicketDetails — combined metadata + market status (TicketDetails struct)
  {
    inputs: [{ internalType: "uint256", name: "tokenID", type: "uint256" }],
    name: "getTicketDetails",
    outputs: [
      {
        components: [
          { internalType: "string",  name: "ticketID",     type: "string"  },
          { internalType: "string",  name: "eventID",      type: "string"  },
          { internalType: "string",  name: "seatNumber",   type: "string"  },
          { internalType: "uint256", name: "faceValue",    type: "uint256" },
          { internalType: "address", name: "currentOwner", type: "address" },
          { internalType: "address", name: "organizer",    type: "address" },
          { internalType: "bool",    name: "isForSale",    type: "bool"    },
          { internalType: "uint256", name: "resalePrice",  type: "uint256" },
          { internalType: "bool",    name: "isValid",      type: "bool"    },
          { internalType: "bool",    name: "isRedeemed",   type: "bool"    },
        ],
        internalType: "struct ValidusTicket.TicketDetails",
        name: "details",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

type EventInfo = {
  eventId: bigint;
  name: string;
  location: string;
  eventDate: bigint;
  ticketPrice: bigint;
  totalTickets: bigint;
  ticketsSold: bigint;
  active: boolean;
};

type TicketInfo = {
  tokenId: bigint;
  ticketID: string;
  eventID: string;
  seatNumber: string;
  faceValue: bigint;
  isForSale: boolean;
  resalePrice: bigint;
  isValid: boolean;
  isRedeemed: boolean;
};

type EventFilter = "all" | "active" | "sold-out";

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Something went wrong while communicating with MetaMask or Sepolia.";
  }

  // Always surface the full error details to the console so the real revert reason is visible
  console.error("[ValidusTicket] Error details:", {
    reason: (error as any).reason,
    data: (error as any).data,
    shortMessage: (error as any).shortMessage,
    code: (error as any).code,
    message: (error as any).message,
  });

  const walletError = error as {
    code?: string | number;
    reason?: string;
    shortMessage?: string;
    message?: string;
    data?: string;
  };

  if (walletError.code === 4001 || walletError.code === "ACTION_REJECTED") {
    return "The request was cancelled in MetaMask.";
  }
  if (walletError.code === 4902) {
    return "Sepolia is not available in MetaMask. Add the Sepolia network and try again.";
  }
  if (walletError.code === "INSUFFICIENT_FUNDS") {
    return "Your wallet does not have enough Sepolia ETH to cover the ticket price and gas.";
  }
  if (walletError.reason) {
    return `The contract rejected the request: ${walletError.reason}`;
  }
  if (walletError.data) {
    return `The contract reverted with data: ${walletError.data}`;
  }
  if (
    walletError.message?.includes("could not decode result data") ||
    walletError.message?.includes("missing revert data") ||
    walletError.message?.includes("no matching fragment")
  ) {
    return "This contract does not expose the requested event or ticket method. Check that the configured Sepolia address and ABI match.";
  }
  if (walletError.message?.includes("Failed to fetch")) {
    return "Could not reach a Sepolia RPC. Check your connection and try again.";
  }

  return (
    walletError.shortMessage ||
    walletError.message ||
    "Something went wrong while communicating with MetaMask or Sepolia."
  );
}

async function ensureContractDeployed(
  provider: ethers.Provider,
  contractAddress: string
): Promise<void> {
  const bytecode = await provider.getCode(contractAddress);
  if (bytecode === "0x") {
    throw new Error(`No contract is deployed at ${contractAddress} on Sepolia.`);
  }
}

function formatEventDate(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function remainingTickets(event: EventInfo): bigint {
  return event.totalTickets > event.ticketsSold
    ? event.totalTickets - event.ticketsSold
    : 0n;
}

function getTicketStatus(ticket: TicketInfo): string {
  if (ticket.isRedeemed) return "Redeemed";
  if (!ticket.isValid) return "Invalid";
  if (ticket.isForSale) return "Listed for resale";
  return "Valid";
}

export default function BuyerDashboard() {
  const [contractAddress] = useState<string>(getConfiguredContractAddress);
  const [account, setAccount] = useState<string | null>(null);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [selectedEvent, setSelectedEvent] = useState<EventInfo | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketInfo | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [purchaseEventId, setPurchaseEventId] = useState<bigint | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{
    eventName: string;
    transactionHash: string;
  } | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  const createReadClient = useCallback(async () => {
    const provider = await getSepoliaProvider();
    return {
      contract: new ethers.Contract(contractAddress, BUYER_ABI, provider),
      provider,
    };
  }, [contractAddress]);

  const loadEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    setEventError(null);
    try {
      const { contract, provider } = await createReadClient();
      await ensureContractDeployed(provider, contractAddress);
      const fetchedEvents: EventInfo[] = [];

      // Use totalEvents() to know exactly how many IDs to fetch — no blind scanning.
      const count: bigint = await contract.totalEvents();
      const total = Number(count);

      if (total === 0) {
        setEvents([]);
        return;
      }

      // Fetch all event IDs in parallel batches of 25.
      let firstReadError: unknown;
      for (let startId = 1; startId <= total; startId += 25) {
        const eventIds = Array.from(
          { length: Math.min(25, total - startId + 1) },
          (_, index) => startId + index
        );
        const results = await Promise.allSettled(
          eventIds.map((eventId) => contract.getEventDetails(eventId))
        );
        results.forEach((result) => {
          if (result.status === "rejected") {
            firstReadError ??= result.reason;
            return;
          }
          const raw = result.value;
          if (!raw?.name?.trim()) return;
          fetchedEvents.push({
            eventId: BigInt(raw.eventId),
            name: raw.name,
            location: raw.location,
            eventDate: BigInt(raw.eventDate),
            ticketPrice: BigInt(raw.ticketPrice),
            totalTickets: BigInt(raw.totalTickets),
            ticketsSold: BigInt(raw.ticketsSold),
            active: Boolean(raw.active),
          });
        });
      }

      if (fetchedEvents.length === 0 && firstReadError) {
        throw firstReadError;
      }
      if (firstReadError) {
        console.warn("Some event IDs could not be read while scanning the contract.", firstReadError);
        setEventError(
          `Loaded ${fetchedEvents.length} events, but some IDs failed: ${getErrorMessage(firstReadError)}`
        );
      }
      fetchedEvents.sort((a, b) => (a.eventId > b.eventId ? -1 : a.eventId < b.eventId ? 1 : 0));
      setEvents(fetchedEvents);
    } catch (error) {
      console.error("Failed to fetch marketplace events:", error);
      setEventError(getErrorMessage(error));
    } finally {
      setIsLoadingEvents(false);
    }
  }, [contractAddress, createReadClient]);

  const loadTickets = useCallback(
    async (owner: string) => {
      setIsLoadingTickets(true);
      setTicketError(null);
      try {
        const { contract, provider } = await createReadClient();
        await ensureContractDeployed(provider, contractAddress);
        const balance: bigint = await contract.balanceOf(owner);

        if (balance === 0n) {
          setTickets([]);
          return;
        }

        // ERC721 (non-Enumerable) — scan token IDs from 1 upward.
        // We stop after finding all `balance` tickets owned, capped at 500 IDs to avoid abuse.
        const MAX_TOKEN_SCAN = 500;
        const ownedTickets: TicketInfo[] = [];

        const candidateIds = Array.from({ length: MAX_TOKEN_SCAN }, (_, i) => BigInt(i + 1));
        const results = await Promise.allSettled(
          candidateIds.map(async (tokenId) => {
            const raw = await contract.getTicketDetails(tokenId);
            return { tokenId, raw };
          }),
        );

        for (const result of results) {
          if (result.status === "rejected") continue;
          const { tokenId, raw } = result.value;
          // Skip tokens not owned by this address
          if ((raw.currentOwner as string).toLowerCase() !== owner.toLowerCase()) continue;
          ownedTickets.push({
            tokenId,
            ticketID: raw.ticketID,
            eventID: raw.eventID,
            seatNumber: raw.seatNumber,
            faceValue: BigInt(raw.faceValue),
            isForSale: Boolean(raw.isForSale),
            resalePrice: BigInt(raw.resalePrice),
            isValid: Boolean(raw.isValid),
            isRedeemed: Boolean(raw.isRedeemed),
          } satisfies TicketInfo);

          if (BigInt(ownedTickets.length) >= balance) break;
        }

        setTickets(ownedTickets);
      } catch (error) {
        console.error("Failed to fetch wallet tickets:", error);
        setTicketError(getErrorMessage(error));
        setTickets([]);
      } finally {
        setIsLoadingTickets(false);
      }
    },
    [contractAddress, createReadClient],
  );

  // Initial load + 15-second polling for new events (stops on unmount)
  useEffect(() => {
    void loadEvents();

    const intervalId = setInterval(() => {
      void loadEvents();
    }, 15_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadEvents]);

  useEffect(() => {
    if (!account) {
      setTickets([]);
      return;
    }
    void loadTickets(account);
  }, [account, loadTickets]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setAccount(accounts[0] ?? null);
    };
    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);
    window.ethereum
      .request({ method: "eth_accounts" })
      .then(async (accounts: string[]) => {
        setAccount(accounts[0] ?? null);
        if (accounts.length) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const network = await provider.getNetwork();
          setWrongNetwork(network.chainId !== SEPOLIA_CHAIN_ID);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to check connected MetaMask accounts:", error);
      });

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (eventFilter === "sold-out") return remainingTickets(event) === 0n;
        if (eventFilter === "active") {
          return (
            event.active &&
            remainingTickets(event) > 0n &&
            Number(event.eventDate) * 1000 >= Date.now()
          );
        }
        return true;
      }),
    [events, eventFilter]
  );

  async function connectWallet() {
    setPurchaseError(null);
    if (!window.ethereum) {
      setPurchaseError("MetaMask was not detected. Install MetaMask to connect your wallet.");
      return;
    }

    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts.length) {
        setPurchaseError("No wallet account was returned by MetaMask.");
        return;
      }
      const network = await provider.getNetwork();
      setWrongNetwork(network.chainId !== SEPOLIA_CHAIN_ID);
      setAccount(accounts[0]);
    } catch (error) {
      console.error("Failed to connect MetaMask:", error);
      setPurchaseError(getErrorMessage(error));
    } finally {
      setIsConnecting(false);
    }
  }

  async function switchToSepolia() {
    if (!window.ethereum) {
      setPurchaseError("MetaMask was not detected. Install MetaMask to switch networks.");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
      setWrongNetwork(false);
    } catch (error) {
      const code =
        error && typeof error === "object" ? (error as { code?: number }).code : undefined;
      if (code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID_HEX,
                chainName: "Sepolia Testnet",
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: SEPOLIA_RPC_URLS,
                blockExplorerUrls: [EVENT_EXPLORER_URL],
              },
            ],
          });
          setWrongNetwork(false);
          return;
        } catch (addError) {
          console.error("Failed to add Sepolia to MetaMask:", addError);
          setPurchaseError(getErrorMessage(addError));
          return;
        }
      }
      console.error("Failed to switch MetaMask to Sepolia:", error);
      setPurchaseError(getErrorMessage(error));
    }
  }

  async function buySelectedEvent() {
    if (!selectedEvent) return;
    setPurchaseError(null);
    setPurchaseSuccess(null);
    if (!window.ethereum) {
      setPurchaseError("MetaMask was not detected. Install MetaMask to purchase a ticket.");
      return;
    }
    if (!account) {
      setPurchaseError("Connect your wallet before purchasing a ticket.");
      return;
    }

    setPurchaseEventId(selectedEvent.eventId);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== SEPOLIA_CHAIN_ID) {
        setWrongNetwork(true);
        throw new Error("Switch MetaMask to Sepolia before purchasing.");
      }
      await ensureContractDeployed(provider, contractAddress);

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, BUYER_ABI, signer);
      const transaction = await contract.buyTicket(selectedEvent.eventId, {
        value: selectedEvent.ticketPrice,
      });
      const receipt = await transaction.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error("The ticket purchase transaction did not succeed.");
      }

      setPurchaseSuccess({
        eventName: selectedEvent.name,
        transactionHash: transaction.hash,
      });
      setSelectedEvent(null);
      await Promise.all([loadEvents(), loadTickets(account)]);
    } catch (error) {
      console.error("Ticket purchase failed:", error);
      setPurchaseError(getErrorMessage(error));
    } finally {
      setPurchaseEventId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] pb-16 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_75%_50%_at_50%_-15%,rgba(236,72,153,0.18),transparent_70%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0c0c12]/85 px-4 py-3 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-pink-500/30 bg-pink-500/15 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
              <PandaLogo className="size-8" />
            </span>
            <span>
              <span className="block bg-gradient-to-r from-pink-300 to-pink-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
                Validus
              </span>
              <span className="hidden text-xs text-zinc-400 sm:block">
                NFT ticketing · Sepolia
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/organizer"
              className="hidden rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-pink-500/40 hover:text-pink-300 sm:inline-flex"
            >
              Organizer dashboard
            </Link>
            {account ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/10 px-3 py-2 text-xs font-semibold text-pink-200">
                <Wallet className="size-3.5" />
                {account.slice(0, 6)}…{account.slice(-4)}
              </span>
            ) : (
              <button
                type="button"
                onClick={connectWallet}
                disabled={isConnecting}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-pink-400 disabled:cursor-wait disabled:opacity-60"
              >
                <Wallet className="size-3.5" />
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-8 sm:px-8">
        <section className="mb-8 flex flex-col justify-between gap-5 rounded-3xl border border-white/10 bg-[#111116]/80 p-6 shadow-2xl shadow-pink-950/10 sm:flex-row sm:items-center sm:p-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-500/25 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-300">
              <Ticket className="size-3.5" />
              Buyer studio
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Find your next <span className="text-pink-400">live moment.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Browse events, purchase tickets with your Sepolia wallet, and keep your Validus NFTs
              together.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadEvents()}
            disabled={isLoadingEvents}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-pink-500/40 hover:text-pink-300 disabled:opacity-50 sm:self-center"
          >
            <RefreshCw className={`size-4 ${isLoadingEvents ? "animate-spin" : ""}`} />
            Refresh events
          </button>
        </section>

        {wrongNetwork && (
          <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 sm:flex-row sm:items-center">
            <p className="text-sm text-amber-100">
              Your wallet is connected to a network other than Sepolia.
            </p>
            <button
              type="button"
              onClick={switchToSepolia}
              className="rounded-lg border border-amber-300/30 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-300/10"
            >
              Switch to Sepolia
            </button>
          </div>
        )}

        {purchaseSuccess && (
          <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <CheckCircle2 className="size-5 shrink-0" />
              Ticket purchased! NFT sent to wallet · {purchaseSuccess.eventName}
            </p>
            <a
              href={`${EVENT_EXPLORER_URL}/tx/${purchaseSuccess.transactionHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-xs font-bold text-emerald-200 underline underline-offset-4 sm:self-center"
            >
              View transaction <ExternalLink className="size-3.5" />
            </a>
          </div>
        )}
        {purchaseError && (
          <div role="alert" className="mb-6 flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{purchaseError}</span>
          </div>
        )}

        <section aria-labelledby="browse-events-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-400">Discover</p>
              <h2 id="browse-events-heading" className="mt-1 text-2xl font-bold">
                Browse events
              </h2>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {(["all", "active", "sold-out"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={eventFilter === filter}
                  onClick={() => setEventFilter(filter)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                    eventFilter === filter
                      ? "bg-pink-500/20 text-pink-200"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {filter === "sold-out" ? "Sold out" : filter}
                </button>
              ))}
            </div>
          </div>

          {eventError && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{eventError}</span>
            </div>
          )}

          {isLoadingEvents ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-56 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
                />
              ))}
            </div>
          ) : filteredEvents.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => {
                const available = remainingTickets(event);
                const soldOut = available === 0n;
                return (
                  <button
                    key={event.eventId.toString()}
                    type="button"
                    onClick={() => {
                      setSelectedEvent(event);
                      setPurchaseError(null);
                    }}
                    className="group rounded-2xl border border-white/10 bg-[#111116]/85 p-5 text-left transition hover:-translate-y-0.5 hover:border-pink-500/40 hover:shadow-xl hover:shadow-pink-950/20"
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl border border-pink-500/20 bg-pink-500/10 text-pink-300">
                        <Ticket className="size-5" />
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          soldOut
                            ? "bg-zinc-700/40 text-zinc-400"
                            : event.active
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-amber-400/10 text-amber-200"
                        }`}
                      >
                        {soldOut ? "Sold out" : event.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h3 className="line-clamp-2 min-h-14 text-lg font-bold text-zinc-50 group-hover:text-pink-200">
                      {event.name}
                    </h3>
                    <div className="mt-3 space-y-2 text-xs text-zinc-400">
                      <p className="flex items-center gap-2">
                        <MapPin className="size-3.5 shrink-0 text-pink-400" />
                        <span className="truncate">{event.location}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <CalendarDays className="size-3.5 shrink-0 text-pink-400" />
                        {formatEventDate(event.eventDate)}
                      </p>
                    </div>
                    <div className="mt-5 flex items-end justify-between border-t border-white/[0.07] pt-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          From
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-pink-200">
                          {ethers.formatEther(event.ticketPrice)} ETH
                        </p>
                      </div>
                      <p className="text-xs text-zinc-400">
                        {available.toString()}{" "}
                        {available === 1n ? "ticket" : "tickets"} left
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
              <Ticket className="mx-auto size-8 text-pink-400/70" />
              <p className="mt-3 font-semibold text-zinc-200">
                {eventError ? "Events could not be loaded" : "No events found"}
              </p>
              <p className="mx-auto mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
                No on-chain events were found in the configured contract. Organizer dashboard
                entries appear here only after a successful deployment emits <code>EventCreated</code>.
              </p>
              {!eventError && (
                <button
                  type="button"
                  onClick={() => void loadEvents()}
                  className="mt-4 text-xs font-bold text-pink-300 hover:text-pink-200"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </section>

        <section className="mt-12" aria-labelledby="my-tickets-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-400">Your collection</p>
              <h2 id="my-tickets-heading" className="mt-1 text-2xl font-bold">
                My tickets
              </h2>
            </div>
            {account && (
              <button
                type="button"
                onClick={() => void loadTickets(account)}
                disabled={isLoadingTickets}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-pink-500/40 hover:text-pink-200 disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${isLoadingTickets ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
          </div>

          {ticketError && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{ticketError}</span>
            </div>
          )}
          {!account ? (
            <div className="rounded-2xl border border-white/10 bg-[#111116]/70 px-5 py-10 text-center">
              <Wallet className="mx-auto size-7 text-pink-400" />
              <p className="mt-3 font-semibold">Connect your wallet to see your tickets</p>
              <p className="mt-1 text-sm text-zinc-500">
                Ticket NFTs owned by your address will appear here.
              </p>
            </div>
          ) : isLoadingTickets ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
                />
              ))}
            </div>
          ) : tickets.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tickets.map((ticket) => (
                <article
                  key={ticket.tokenId.toString()}
                  className="rounded-2xl border border-white/10 bg-[#111116]/85 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-300">
                      <Ticket className="size-5" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                      {getTicketStatus(ticket)}
                    </span>
                  </div>
                  <h3 className="mt-4 truncate text-base font-bold text-zinc-50">
                    {ticket.eventID || ticket.ticketID || `Ticket #${ticket.tokenId}`}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    Ticket ID: {ticket.ticketID || ticket.tokenId.toString()}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(ticket)}
                      className="flex-1 rounded-xl border border-pink-500/30 bg-pink-500/10 px-3 py-2 text-xs font-bold text-pink-200 transition hover:bg-pink-500/20"
                    >
                      View details
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Ticket resale listing will be available in Phase 3.5."
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-500 disabled:cursor-not-allowed"
                    >
                      List for resale
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : ticketError ? null : (
            <div className="rounded-2xl border border-white/10 bg-[#111116]/70 px-5 py-10 text-center">
              <Ticket className="mx-auto size-7 text-zinc-500" />
              <p className="mt-3 font-semibold text-zinc-200">No Validus tickets in this wallet</p>
              <p className="mt-1 text-sm text-zinc-500">Purchased or transferred tickets will show up here.</p>
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-white/[0.07] pt-5 text-center text-xs text-zinc-600">
          Contract: <span className="font-mono">{contractAddress}</span>
        </footer>
      </div>

      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEvent(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="selected-event-title"
            className="w-full max-w-lg rounded-3xl border border-pink-500/20 bg-[#111116] p-6 shadow-2xl shadow-pink-950/30 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-pink-400">
                  Event #{selectedEvent.eventId.toString()}
                </span>
                <h2 id="selected-event-title" className="mt-2 text-2xl font-bold">
                  {selectedEvent.name}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close event details"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-5 space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm">
              <p className="flex items-center gap-3 text-zinc-300">
                <MapPin className="size-4 text-pink-400" />
                {selectedEvent.location}
              </p>
              <p className="flex items-center gap-3 text-zinc-300">
                <CalendarDays className="size-4 text-pink-400" />
                {formatEventDate(selectedEvent.eventDate)}
              </p>
              <div className="flex items-center justify-between border-t border-white/[0.07] pt-3">
                <span className="text-zinc-400">Ticket price</span>
                <span className="font-mono font-bold text-pink-200">
                  {ethers.formatEther(selectedEvent.ticketPrice)} ETH
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Tickets available</span>
                <span className="font-semibold text-zinc-200">
                  {remainingTickets(selectedEvent).toString()}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={buySelectedEvent}
              disabled={
                !selectedEvent.active ||
                remainingTickets(selectedEvent) === 0n ||
                purchaseEventId === selectedEvent.eventId
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {purchaseEventId === selectedEvent.eventId
                ? "Waiting for transaction…"
                : remainingTickets(selectedEvent) === 0n
                  ? "Sold out"
                  : "Buy now"}
              {purchaseEventId !== selectedEvent.eventId && <ArrowUpRight className="size-4" />}
            </button>
            {!account && (
              <p className="mt-3 text-center text-xs text-zinc-500">
                Connect your wallet above before continuing to checkout.
              </p>
            )}
          </section>
        </div>
      )}

      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedTicket(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="selected-ticket-title"
            className="w-full max-w-md rounded-3xl border border-pink-500/20 bg-[#111116] p-6 shadow-2xl shadow-pink-950/30"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-400">
                  On-chain ticket
                </p>
                <h2 id="selected-ticket-title" className="mt-2 text-2xl font-bold">
                  {selectedTicket.eventID || selectedTicket.ticketID}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close ticket details"
                onClick={() => setSelectedTicket(null)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/[0.07] pb-3">
                <dt className="text-zinc-400">Token ID</dt>
                <dd className="font-mono text-zinc-200">{selectedTicket.tokenId.toString()}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/[0.07] pb-3">
                <dt className="text-zinc-400">Ticket ID</dt>
                <dd className="text-right text-zinc-200">{selectedTicket.ticketID || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/[0.07] pb-3">
                <dt className="text-zinc-400">Seat</dt>
                <dd className="text-right text-zinc-200">{selectedTicket.seatNumber || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/[0.07] pb-3">
                <dt className="text-zinc-400">Face value</dt>
                <dd className="font-mono text-zinc-200">
                  {ethers.formatEther(selectedTicket.faceValue)} ETH
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400">Status</dt>
                <dd className="font-semibold text-pink-200">{getTicketStatus(selectedTicket)}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </main>
  );
}
