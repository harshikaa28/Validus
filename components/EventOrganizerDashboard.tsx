"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESS_STORAGE_VERSION,
  DEFAULT_CONTRACT_ADDRESS,
  getConfiguredContractAddress,
  getSepoliaProvider,
  SEPOLIA_RPC_URLS,
} from "@/lib/sepolia";

// Declare MetaMask window.ethereum object for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}

// =============================================================================
// TypeScript Interfaces & Constants
// =============================================================================

/**
 * Event data structure matching on-chain getEventDetails() struct
 */
export interface ValidusEvent {
  eventId: number;
  name: string;
  location: string;
  eventDate: number; // Unix timestamp in seconds
  organizer: string;
  ticketPrice: bigint; // In wei
  totalTickets: bigint;
  ticketsSold: bigint;
  active: boolean;
  txHash?: string;
}

/**
 * Form inputs for creating a new event
 */
export interface CreateEventFormInput {
  name: string;
  location: string;
  eventDate: string; // ISO / datetime-local string
  ticketPrice: string; // In ETH (e.g., "0.05")
  totalTickets: string; // Positive integer string (e.g., "100")
}

/**
 * Validation error state for the creation form
 */
export interface FormValidationErrors {
  name?: string;
  location?: string;
  eventDate?: string;
  ticketPrice?: string;
  totalTickets?: string;
}

/**
 * Transaction status state machine
 */
export type TxStatus = "idle" | "validating" | "waiting_signature" | "mining" | "success" | "error";

// Smart Contract Address on Sepolia Testnet
export const CONTRACT_ADDRESS = DEFAULT_CONTRACT_ADDRESS;

// Sepolia Chain Configuration
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // 11155111 in hex
export const SEPOLIA_CHAIN_ID_DEC = 11155111n;
export const SEPOLIA_RPC_FALLBACKS = SEPOLIA_RPC_URLS;

// Contract ABI — ValidusTicket @ 0xa64e9ed54034bd804c878844ce838153ecc796aa (Sepolia)
export const CONTRACT_ABI = [
  // ── Write functions ────────────────────────────────────────────────────────
  {
    inputs: [
      { internalType: "string",  name: "name",         type: "string"  },
      { internalType: "string",  name: "location",     type: "string"  },
      { internalType: "uint256", name: "eventDate",    type: "uint256" },
      { internalType: "uint256", name: "ticketPrice",  type: "uint256" },
      { internalType: "uint256", name: "totalTickets", type: "uint256" },
    ],
    name: "createEvent",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── View functions ─────────────────────────────────────────────────────────
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
  {
    inputs: [],
    name: "totalEvents",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // ── Events ─────────────────────────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "eventId",      type: "uint256" },
      { indexed: false, internalType: "string",  name: "name",         type: "string"  },
      { indexed: false, internalType: "string",  name: "location",     type: "string"  },
      { indexed: false, internalType: "uint256", name: "eventDate",    type: "uint256" },
      { indexed: true,  internalType: "address", name: "organizer",    type: "address" },
      { indexed: false, internalType: "uint256", name: "ticketPrice",  type: "uint256" },
      { indexed: false, internalType: "uint256", name: "totalTickets", type: "uint256" },
    ],
    name: "EventCreated",
    type: "event",
  },
];

// Helper to safely truncate Ethereum addresses
function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// =============================================================================
// Inline SVGs (No external icon packages required)
// =============================================================================
const Icons = {
  Wallet: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  MapPin: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Sparkles: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z" />
    </svg>
  ),
  Ticket: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  ),
  Check: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Copy: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  ExternalLink: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  Refresh: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  TrendingUp: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Spinner: () => (
    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  ),
};

// =============================================================================
// Main Component: EventOrganizerDashboard
// =============================================================================

export default function EventOrganizerDashboard() {
  // ─── 1. Wallet State ────────────────────────────────────────────────────────
  const [account, setAccount] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string>("0.0000");
  const [isConnectingWallet, setIsConnectingWallet] = useState<boolean>(false);
  const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);

  // ─── 2. Event List & Analytics State ───────────────────────────────────────
  const [events, setEvents] = useState<ValidusEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [eventFilter, setEventFilter] = useState<"all" | "active" | "soldout" | "past">("all");

  // ─── Contract Configuration State ──────────────────────────────────────────
  const [contractAddress, setContractAddress] = useState<string>(getConfiguredContractAddress);
  const [isContractModalOpen, setIsContractModalOpen] = useState<boolean>(false);
  const [customContractInput, setCustomContractInput] = useState<string>("");

  // ─── 3. Create Event Form State ────────────────────────────────────────────
  const [form, setForm] = useState<CreateEventFormInput>({
    name: "",
    location: "",
    eventDate: "",
    ticketPrice: "",
    totalTickets: "",
  });
  const [formErrors, setFormErrors] = useState<FormValidationErrors>({});
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txErrorMessage, setTxErrorMessage] = useState<string | null>(null);
  const [createdEventId, setCreatedEventId] = useState<number | null>(null);

  // ─── 4. Notification / Real-time Toast State ────────────────────────────────
  const [liveNotification, setLiveNotification] = useState<{
    message: string;
    type: "success" | "info" | "warning";
  } | null>(null);

  // Reference for event listener cleanup
  const contractListenerRef = useRef<ethers.Contract | null>(null);

  // ─── Helper: User Friendly Error Parser ────────────────────────────────────
  const parseContractError = (error: any): string => {
    if (!error) return "An unexpected error occurred.";

    // Always log the full error details so the real revert reason is visible in DevTools
    console.error("[ValidusTicket] Contract error details:", {
      reason: error.reason,
      data: error.data,
      shortMessage: error.shortMessage,
      code: error.code,
      message: error.message,
    });

    if (error.code === 4001 || error.code === "ACTION_REJECTED") {
      return "Transaction was cancelled in MetaMask.";
    }
    if (error.code === "INSUFFICIENT_FUNDS" || error.message?.includes("insufficient funds")) {
      return "Insufficient Sepolia ETH for gas. Get free Sepolia testnet ETH at https://sepoliafaucet.com or https://cloud.google.com/application/web3/faucet/ethereum/sepolia";
    }
    if (error.message?.includes("user rejected action") || error.message?.includes("User rejected")) {
      return "Transaction was rejected by the wallet user.";
    }
    if (error.reason) {
      return `Contract reverted: ${error.reason}`;
    }
    if (error.data) {
      return `Contract reverted with data: ${error.data}`;
    }
    if (error.shortMessage) {
      return error.shortMessage;
    }
    if (error.message?.includes("cannot estimate gas") || error.code === "UNPREDICTABLE_GAS_LIMIT") {
      return "Gas estimation failed. Ensure the event date is in the future, you are on Sepolia, and your wallet is the contract owner (createEvent is owner-only).";
    }
    if (
      error.message?.includes("missing revert data") ||
      error.message?.includes("could not decode result data")
    ) {
      return "The contract returned no data — the function selector may not exist at the configured address. Check the contract address and ABI.";
    }
    return error.message?.slice(0, 180) || "Failed to submit transaction to Sepolia.";
  };

  // ─── 5. Wallet Connection & Network Handling ────────────────────────────────
  const checkNetwork = async (provider: ethers.BrowserProvider): Promise<boolean> => {
    try {
      const network = await provider.getNetwork();
      const isSepolia = network.chainId === SEPOLIA_CHAIN_ID_DEC;
      setIsWrongNetwork(!isSepolia);
      return isSepolia;
    } catch {
      return false;
    }
  };

  const switchOrAddSepolia = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
      setIsWrongNetwork(false);
      if (account) fetchBalance(account);
    } catch (switchError: any) {
      // 4902 error indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID_HEX,
                chainName: "Sepolia Testnet",
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: SEPOLIA_RPC_FALLBACKS,
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          setIsWrongNetwork(false);
        } catch (addError) {
          console.error("Failed to add Sepolia network:", addError);
        }
      }
    }
  };

  const fetchBalance = async (address: string) => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balanceWei = await provider.getBalance(address);
      const formatted = Number(ethers.formatEther(balanceWei)).toFixed(4);
      setEthBalance(formatted);
    } catch (err) {
      console.warn("Could not fetch balance from browser provider:", err);
    }
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("MetaMask is not detected. Please install MetaMask from metamask.io");
      return;
    }

    setIsConnectingWallet(true);
    setTxErrorMessage(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);

      if (accounts.length > 0) {
        const userAddress = accounts[0];
        setAccount(userAddress);

        const onSepolia = await checkNetwork(provider);
        if (onSepolia) {
          await fetchBalance(userAddress);
        }
      }
    } catch (err: any) {
      console.error("Connection error:", err);
      setTxErrorMessage(parseContractError(err));
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setEthBalance("0.0000");
    setEvents([]);
  };

  const copyAddressToClipboard = () => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // ─── 6. Event Fetching Logic ───────────────────────────────────────────────
  /**
   * Fetches events for the current wallet.
   * Uses browser provider when connected, falls back to public Sepolia RPCs.
   * Reads from tracked IDs in localStorage and discovers on-chain events.
   */
  const loadOrganizerEvents = useCallback(
    async (userAccount: string, customAddr?: string) => {
      if (!userAccount) return;
      setIsLoadingEvents(true);
      const fetched: ValidusEvent[] = [];
      const cachedEventIds = new Set<number>();
      const targetContract = (customAddr || contractAddress || CONTRACT_ADDRESS).trim();

      // 1. Use cached IDs only to discover events; cached data is not proof of deployment.
      const storageKey = `validus_organizer_events_${userAccount.toLowerCase()}`;
      try {
        const rawSaved = localStorage.getItem(storageKey);
        if (rawSaved) {
          const parsed = JSON.parse(rawSaved);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const eventId = Number(item?.eventId);
              if (Number.isSafeInteger(eventId) && eventId > 0) cachedEventIds.add(eventId);
            }
          }
        }
      } catch (err) {
        console.warn("Error reading cached organizer events:", err);
      }

      // 2. Query the ValidusTicket contract on Sepolia using getEventDetails()
      try {
        const provider: ethers.Provider = await getSepoliaProvider();

        const code = await provider.getCode(targetContract);
        if (code && code !== "0x" && code.length > 2) {
          const readContract = new ethers.Contract(targetContract, CONTRACT_ABI, provider);

          // Scan common event IDs and cached IDs, but only display on-chain results.
          const candidateIds = Array.from(
            new Set([...Array.from({ length: 25 }, (_, i) => i + 1), ...Array.from(cachedEventIds)])
          );

          for (const id of candidateIds) {
            try {
              const raw = await readContract.getEventDetails(id);
              if (raw && raw.name && raw.name.trim() !== "") {
                const eventOrganizer = (raw.organizer || "").toLowerCase();
                if (eventOrganizer === userAccount.toLowerCase()) {
                  const evId = Number(raw.eventId || id);
                  const validusEv: ValidusEvent = {
                    eventId: evId,
                    name: raw.name,
                    location: raw.location,
                    eventDate: Number(raw.eventDate),
                    organizer: raw.organizer,
                    ticketPrice: BigInt(raw.ticketPrice.toString()),
                    totalTickets: BigInt(raw.totalTickets.toString()),
                    ticketsSold: BigInt(raw.ticketsSold.toString()),
                    active: Boolean(raw.active),
                  };

                  fetched.push(validusEv);
                }
              }
            } catch {
              // Gracefully continue candidate scan
            }
          }
        }
      } catch (err) {
        console.warn("Contract getEventDetails query notice:", err);
      }

      // 3. Save verified on-chain events to localStorage
      try {
        const toSave = fetched.map((ev) => ({
          eventId: ev.eventId,
          name: ev.name,
          location: ev.location,
          eventDate: ev.eventDate,
          organizer: ev.organizer,
          ticketPrice: ev.ticketPrice.toString(),
          totalTickets: ev.totalTickets.toString(),
          ticketsSold: ev.ticketsSold.toString(),
          active: ev.active,
          txHash: ev.txHash,
        }));
        localStorage.setItem(storageKey, JSON.stringify(toSave));
      } catch (e) {
        console.warn("Failed to persist organizer events to cache:", e);
      }

      // Sort latest events first
      fetched.sort((a, b) => b.eventId - a.eventId);
      setEvents(fetched);
      setIsLoadingEvents(false);
    },
    [contractAddress]
  );

  // ─── 7. Real-Time Smart Contract Event Listener ────────────────────────────
  useEffect(() => {
    if (!account || typeof window === "undefined" || !window.ethereum) return;

    let activeContract: ethers.Contract | null = null;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      activeContract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
      contractListenerRef.current = activeContract;

      // Listen for EventCreated(eventId, name, location, eventDate, organizer, ticketPrice, totalTickets)
      const onEventCreated = (
        eventIdBig: any,
        name: string,
        _location: string,
        _eventDate: any,
        organizer: string
      ) => {
        const id = Number(eventIdBig);
        if (organizer.toLowerCase() === account.toLowerCase()) {
          setLiveNotification({
            type: "success",
            message: `Event #${id} "${name}" was created successfully on Sepolia!`,
          });
          loadOrganizerEvents(account);
          fetchBalance(account);
        }
      };

      activeContract.on("EventCreated", onEventCreated);

      return () => {
        if (activeContract) {
          activeContract.off("EventCreated", onEventCreated);
        }
      };
    } catch (e) {
      console.warn("EventCreated listener initialization error:", e);
    }
  }, [account, contractAddress, loadOrganizerEvents]);

  // Auto-dismiss live notifications after 6 seconds
  useEffect(() => {
    if (liveNotification) {
      const timer = setTimeout(() => setLiveNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [liveNotification]);

  // Initial Wallet & Account Change Listeners
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        fetchBalance(accounts[0]);
        loadOrganizerEvents(accounts[0]);
      } else {
        disconnectWallet();
      }
    };

    const handleChainChanged = () => {
      // Reload on network switch as recommended by MetaMask
      window.location.reload();
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    // Auto-check if already connected
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          fetchBalance(accounts[0]);
          loadOrganizerEvents(accounts[0]);
        }
      })
      .catch((e: any) => console.warn("Auto-connect check error:", e));

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [loadOrganizerEvents]);

  // ─── 8. Quick Fill Demo & Form Validation ───────────────────────────────────
  const handleQuickFillDemo = () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    futureDate.setHours(19, 0, 0, 0);
    const dateStr = futureDate.toISOString().slice(0, 16);

    setForm({
      name: "Coldplay: Music of the Spheres Live",
      location: "Bangalore International Arena, India",
      eventDate: dateStr,
      ticketPrice: "0.01",
      totalTickets: "100",
    });
    setFormErrors({});
    setTxErrorMessage(null);
  };

  const validateForm = (): { isValid: boolean; errors: FormValidationErrors } => {
    const errors: FormValidationErrors = {};

    if (!form.name.trim()) {
      errors.name = "Event name is required.";
    } else if (form.name.length < 3) {
      errors.name = "Event name must be at least 3 characters.";
    }

    if (!form.location.trim()) {
      errors.location = "Venue or location is required.";
    }

    if (!form.eventDate) {
      errors.eventDate = "Please choose an event date.";
    } else {
      const selectedTimestamp = new Date(form.eventDate).getTime();
      const currentTimestamp = Date.now();
      if (isNaN(selectedTimestamp) || selectedTimestamp <= currentTimestamp) {
        errors.eventDate = "Event date must be scheduled in the future.";
      }
    }

    const priceNum = parseFloat(form.ticketPrice);
    if (!form.ticketPrice || isNaN(priceNum) || priceNum <= 0) {
      errors.ticketPrice = "Ticket price must be a positive ETH value (e.g., 0.05).";
    }

    const totalTicketsNum = parseInt(form.totalTickets, 10);
    if (!form.totalTickets || isNaN(totalTicketsNum) || totalTicketsNum <= 0) {
      errors.totalTickets = "Total tickets must be at least 1.";
    } else if (totalTicketsNum > 100000) {
      errors.totalTickets = "Max capacity capped at 100,000 tickets.";
    }

    setFormErrors(errors);
    return { isValid: Object.keys(errors).length === 0, errors };
  };

  // ─── 9. Form Submission: createEvent() Call ────────────────────────────────
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) {
      setTxErrorMessage("Please connect your MetaMask wallet first.");
      connectWallet();
      return;
    }

    if (isWrongNetwork) {
      setTxErrorMessage("Switching your wallet to Sepolia Testnet. Please approve in MetaMask...");
      try {
        await switchOrAddSepolia();
      } catch {
        setTxErrorMessage("Please switch network to Sepolia in MetaMask before deploying.");
        return;
      }
    }

    setTxErrorMessage(null);
    setTxStatus("validating");

    const { isValid, errors } = validateForm();
    if (!isValid) {
      setTxStatus("error");
      const firstError = Object.values(errors)[0] || "Please fill in all required event details.";
      setTxErrorMessage(firstError);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const code = await provider.getCode(contractAddress);
      if (code === "0x") {
        throw new Error(`No contract is deployed at ${contractAddress} on Sepolia.`);
      }
      const signer = await provider.getSigner();
      const contractWithSigner = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

      // Convert inputs to contract parameter types
      const name = form.name.trim();
      const location = form.location.trim();
      const unixDateInSeconds = BigInt(Math.floor(new Date(form.eventDate).getTime() / 1000));
      const priceWei = ethers.parseEther(form.ticketPrice.trim());
      const totalTicketsBig = BigInt(form.totalTickets.trim());

      setTxStatus("waiting_signature");

      // Dispatch transaction with gas limit fallback so MetaMask prompt is never blocked
      let tx: ethers.ContractTransactionResponse;
      try {
        const estimatedGas = await contractWithSigner.createEvent.estimateGas(
          name,
          location,
          unixDateInSeconds,
          priceWei,
          totalTicketsBig
        );
        const gasLimit = (estimatedGas * 130n) / 100n;
        tx = await contractWithSigner.createEvent(
          name,
          location,
          unixDateInSeconds,
          priceWei,
          totalTicketsBig,
          { gasLimit }
        );
      } catch (gasEstErr: any) {
        console.warn("Gas estimation notice: fallback to 500,000 gas limit", {
          reason: gasEstErr?.reason,
          data: gasEstErr?.data,
          shortMessage: gasEstErr?.shortMessage,
          message: gasEstErr?.message,
        });
        tx = await contractWithSigner.createEvent(
          name,
          location,
          unixDateInSeconds,
          priceWei,
          totalTicketsBig,
          { gasLimit: 500000n }
        );
      }

      setTxHash(tx.hash);
      setTxStatus("mining");

      // Wait for 1 confirmation on Sepolia
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) {
        throw new Error("The event deployment transaction did not succeed.");
      }

      // Only treat the transaction as a deployment if this contract emitted EventCreated.
      let newId = 0;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
        try {
          const parsed = contractWithSigner.interface.parseLog(log);
          if (parsed?.name === "EventCreated") {
            newId = Number(parsed.args.eventId);
            break;
          }
        } catch {
          // Not a matching log
        }
      }
      if (!newId || newId <= 0) {
        throw new Error(
          "The transaction succeeded but did not emit EventCreated. Confirm the configured address and contract ABI."
        );
      }
      const createdEvent = await contractWithSigner.getEventDetails(newId);
      if (
        createdEvent.name !== name ||
        createdEvent.organizer.toLowerCase() !== account.toLowerCase()
      ) {
        throw new Error("The created event could not be verified on the configured contract.");
      }

      setCreatedEventId(newId);
      setTxStatus("success");
      setLiveNotification({
        type: "success",
        message: `Event #${newId} "${name}" deployed successfully to Sepolia!`,
      });

      // Persist newly created event object to local storage
      const storageKey = `validus_organizer_events_${account.toLowerCase()}`;
      const newEvObj = {
        eventId: newId,
        name,
        location,
        eventDate: Number(unixDateInSeconds),
        organizer: account,
        ticketPrice: priceWei.toString(),
        totalTickets: totalTicketsBig.toString(),
        ticketsSold: "0",
        active: true,
        txHash: tx.hash,
      };

      try {
        const existingRaw = localStorage.getItem(storageKey);
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        const updated = [newEvObj, ...existing.filter((x: any) => x.eventId !== newId)];
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn("Storage write error", e);
      }

      // Append new event optimistically
      const optimisticEvent: ValidusEvent = {
        eventId: newId,
        name,
        location,
        eventDate: Number(unixDateInSeconds),
        organizer: account,
        ticketPrice: priceWei,
        totalTickets: totalTicketsBig,
        ticketsSold: 0n,
        active: true,
        txHash: tx.hash,
      };

      setEvents((prev) => [optimisticEvent, ...prev.filter((item) => item.eventId !== newId)]);

      // Reset form
      setForm({
        name: "",
        location: "",
        eventDate: "",
        ticketPrice: "",
        totalTickets: "",
      });
      setFormErrors({});

      // Refresh on-chain balance and full list
      fetchBalance(account);
      loadOrganizerEvents(account);
    } catch (err: any) {
      console.error("Create event error:", err);
      setTxStatus("error");
      setTxErrorMessage(parseContractError(err));
    }
  };

  // ─── 10. Analytics Calculations ────────────────────────────────────────────
  /**
   * Required Formula:
   * Revenue Earned = tickets sold × price × 5%
   */
  const analytics = useMemo(() => {
    let totalTicketsSold = 0;
    let totalCapacity = 0;
    let totalRevenueEth = 0;
    let grossTicketVolumeEth = 0;
    let activeEventsCount = 0;

    events.forEach((ev) => {
      const sold = Number(ev.ticketsSold);
      const cap = Number(ev.totalTickets);
      const priceEth = Number(ethers.formatEther(ev.ticketPrice));

      totalTicketsSold += sold;
      totalCapacity += cap;

      // Exact prompt formula: (tickets sold × price × 5%)
      const revenue5Percent = sold * priceEth * 0.05;
      totalRevenueEth += revenue5Percent;
      grossTicketVolumeEth += sold * priceEth;

      if (ev.active) activeEventsCount++;
    });

    const overallProgressPercent =
      totalCapacity > 0 ? Math.min(100, Math.round((totalTicketsSold / totalCapacity) * 100)) : 0;

    return {
      totalTicketsSold,
      totalCapacity,
      totalRevenueEth: totalRevenueEth.toFixed(4),
      grossTicketVolumeEth: grossTicketVolumeEth.toFixed(4),
      activeEventsCount,
      totalEvents: events.length,
      overallProgressPercent,
    };
  }, [events]);

  // ─── 11. Filtered Events ───────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return events.filter((ev) => {
      if (eventFilter === "active") return ev.active && ev.eventDate >= now;
      if (eventFilter === "soldout") return Number(ev.ticketsSold) >= Number(ev.totalTickets);
      if (eventFilter === "past") return ev.eventDate < now;
      return true;
    });
  }, [events, eventFilter]);

  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <div className="w-full min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-pink-500 selection:text-white pb-16">
      {/* ─── Top Glow Gradient & Grid Background ─── */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_75%_50%_at_50%_-15%,rgba(236,72,153,0.18),transparent_70%)] z-0" />
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] z-0" />

      {/* ─── Global Navigation Header ─── */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0c0c12]/80 backdrop-blur-xl px-4 py-3.5 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-pink-500/15 border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.3)]">
              <span className="text-pink-400 font-black text-xl font-mono">V</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-pink-400 via-rose-300 to-pink-500 bg-clip-text text-transparent">
                  Validus
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-500/10 text-pink-400 border border-pink-500/25">
                  Organizer Studio
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Anti-Scalp NFT Ticketing Protocol • Sepolia
              </p>
            </div>
          </div>

          {/* Network Badge & Wallet Controls */}
          <div className="flex items-center gap-3">
            {/* Sepolia Contract Badge */}
            <button
              type="button"
              onClick={() => {
                setCustomContractInput(contractAddress);
                setIsContractModalOpen(true);
              }}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium border bg-zinc-900/90 border-white/10 hover:border-pink-500/40 text-zinc-300 transition-all hover:bg-zinc-800/80"
              title="Click to view or edit ValidusTicket contract address"
            >
              <span className="text-[10px] text-pink-400 font-sans uppercase font-bold">Contract:</span>
              <span>{shortenAddress(contractAddress)}</span>
              <span className="text-[10px] text-zinc-400 hover:text-white underline ml-1 font-sans">Edit</span>
            </button>

            {/* Sepolia Network Badge */}
            {account && (
              <div
                className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                  isWrongNetwork
                    ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    isWrongNetwork ? "bg-rose-400 animate-ping" : "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                  }`}
                />
                <span>{isWrongNetwork ? "Wrong Network" : "Sepolia"}</span>
              </div>
            )}

            {/* Wallet Button */}
            {!account ? (
              <button
                type="button"
                onClick={connectWallet}
                disabled={isConnectingWallet}
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all shadow-[0_0_20px_rgba(236,72,153,0.35)] hover:shadow-[0_0_25px_rgba(236,72,153,0.55)] active:scale-95 disabled:opacity-50"
              >
                {isConnectingWallet ? (
                  <>
                    <Icons.Spinner />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Icons.Wallet />
                    <span>Connect MetaMask</span>
                  </>
                )}
              </button>
            ) : isWrongNetwork ? (
              <button
                type="button"
                onClick={switchOrAddSepolia}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30 transition-all active:scale-95"
              >
                <Icons.AlertTriangle />
                <span>Switch to Sepolia</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-zinc-900/90 border border-white/10 shadow-inner">
                {/* ETH Balance */}
                <div className="flex items-center gap-1.5 pr-2 border-r border-white/10">
                  <span className="text-pink-400 font-bold text-xs">◆</span>
                  <span className="font-mono text-xs font-semibold text-zinc-100">{ethBalance}</span>
                  <span className="text-[10px] text-zinc-400 font-mono">ETH</span>
                </div>

                {/* Truncated Address */}
                <button
                  type="button"
                  onClick={copyAddressToClipboard}
                  title="Click to copy address"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-xs font-mono text-zinc-200"
                >
                  <span className="size-2 rounded-full bg-emerald-400" />
                  <span>{shortenAddress(account)}</span>
                  {copiedAddress ? (
                    <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>
                  ) : (
                    <Icons.Copy />
                  )}
                </button>

                {/* Etherscan Link */}
                <a
                  href={`https://sepolia.etherscan.io/address/${account}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on Etherscan"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Icons.ExternalLink />
                </a>

                {/* Disconnect */}
                <button
                  type="button"
                  onClick={disconnectWallet}
                  title="Disconnect Wallet"
                  className="px-2 py-1 text-[11px] text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Real-Time Live Notification Toast ─── */}
      {liveNotification && (
        <div className="relative z-50 max-w-7xl mx-auto px-4 mt-4">
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-pink-500/40 bg-pink-950/60 text-pink-200 backdrop-blur-md shadow-lg shadow-pink-950/50 animate-bounce">
            <div className="flex items-center gap-3">
              <span className="p-1 rounded-lg bg-pink-500/20 text-pink-400">
                <Icons.Sparkles />
              </span>
              <p className="text-sm font-medium">{liveNotification.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setLiveNotification(null)}
              className="text-xs text-pink-400 hover:text-white underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Studio Container ─── */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-8 flex flex-col gap-8">
        {/* ─── Hero Title & Protocol Specs ─── */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-pink-400 bg-pink-500/10 border border-pink-500/20 mb-2">
              <Icons.Sparkles />
              <span>Validus Smart Contract v1.0 • Anti-Scalping Engine</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Event Organizer Dashboard
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl mt-1.5">
              Mint official ERC-721 ticket collections, enforce secondary market 1.5× resale price
              caps, and earn guaranteed 5% royalties on every secondary transfer.
            </p>
          </div>

          {/* Quick Smart Contract Info Pill */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/80 border border-white/10 text-xs font-mono text-zinc-300">
            <span className="text-pink-400 font-bold">Contract:</span>
            <a
              href={`https://sepolia.etherscan.io/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-pink-400 transition-colors flex items-center gap-1.5"
            >
              <span>{shortenAddress(contractAddress)}</span>
              <Icons.ExternalLink />
            </a>
            <span className="text-zinc-600">|</span>
            <button
              type="button"
              onClick={() => {
                setCustomContractInput(contractAddress);
                setIsContractModalOpen(true);
              }}
              className="text-[11px] text-pink-400 hover:text-pink-300 underline font-sans font-semibold transition-colors"
            >
              Change Address
            </button>
          </div>
        </section>

        {/* ─── 4. Event Analytics Section ─── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Revenue Earned (tickets sold × price × 5%) */}
          <div className="relative overflow-hidden p-5 rounded-2xl bg-zinc-900/60 border border-white/10 shadow-lg hover:border-pink-500/30 transition-all group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-pink-400">
                Royalty Revenue Earned
              </span>
              <Icons.TrendingUp />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white font-mono">
                {analytics.totalRevenueEth}
              </span>
              <span className="text-xs font-bold text-pink-400 font-mono">ETH</span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1">
              <span>tickets sold × price × 5% royalty</span>
            </div>
          </div>

          {/* Card 2: Tickets Sold Counter */}
          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 shadow-lg hover:border-pink-500/30 transition-all group">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-zinc-300">
                Tickets Sold Counter
              </span>
              <Icons.Ticket />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono">
                {analytics.totalTicketsSold}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                / {analytics.totalCapacity} capacity
              </span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-400">
              Across {analytics.totalEvents} organized event{analytics.totalEvents === 1 ? "" : "s"}
            </div>
          </div>

          {/* Card 3: Overall Sales Progress Bar */}
          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 shadow-lg hover:border-pink-500/30 transition-all group">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-zinc-300">
                Overall Sales Progress
              </span>
              <span className="text-pink-400 font-bold font-mono">
                {analytics.overallProgressPercent}%
              </span>
            </div>
            <div className="mt-3 w-full bg-zinc-800 rounded-full h-3 overflow-hidden p-0.5 border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(236,72,153,0.5)]"
                style={{ width: `${analytics.overallProgressPercent}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-zinc-400 flex justify-between">
              <span>{analytics.totalTicketsSold} sold</span>
              <span>{Math.max(0, analytics.totalCapacity - analytics.totalTicketsSold)} remaining</span>
            </div>
          </div>

          {/* Card 4: Active Events */}
          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 shadow-lg hover:border-pink-500/30 transition-all group">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-zinc-300">
                Active Listings
              </span>
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white font-mono">
                {analytics.activeEventsCount}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                active of {analytics.totalEvents}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-400">
              Gross Volume:{" "}
              <span className="text-zinc-200 font-mono">{analytics.grossTicketVolumeEth} ETH</span>
            </div>
          </div>
        </section>

        {/* ─── Studio Core Grid: Create Form & My Events List ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ═══════════════════════════════════════════════════════════════════
              LEFT COLUMN: CREATE EVENT FORM
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 bg-zinc-900/80 rounded-2xl border border-white/10 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-pink-500/15 text-pink-400 border border-pink-500/30">
                  <Icons.Sparkles />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Create New Event</h2>
                  <p className="text-xs text-zinc-400">Deploy ticket parameters to Sepolia contract</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickFillDemo}
                  title="Click to populate realistic sample data for instant testing"
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-500/15 text-pink-400 border border-pink-500/30 hover:bg-pink-500/25 transition-all active:scale-95 flex items-center gap-1"
                >
                  <Icons.Sparkles />
                  <span>Quick Fill</span>
                </button>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-pink-400 border border-pink-500/20 hidden sm:inline-block">
                  createEvent()
                </span>
              </div>
            </div>

            {/* Error Banner */}
            {txErrorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5 text-rose-400">
                  <Icons.AlertTriangle />
                </span>
                <div className="flex-1">
                  <p className="font-semibold">Transaction Error</p>
                  <p className="mt-0.5 text-rose-300/90 leading-relaxed">{txErrorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTxErrorMessage(null)}
                  className="text-rose-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Success Banner */}
            {txStatus === "success" && (
              <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                    <Icons.Check />
                  </span>
                  <span className="font-bold text-sm">Event Deployed Successfully!</span>
                </div>
                <p className="text-emerald-300/80 leading-relaxed">
                  Your event has been written to the ValidusTicket registry on Sepolia. Attendees
                  can now mint passes with guaranteed 1.5× anti-scalp resale enforcement.
                </p>
                {txHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-pink-400 hover:underline font-mono text-[11px] mt-1"
                  >
                    <span>View Transaction: {shortenAddress(txHash)}</span>
                    <Icons.ExternalLink />
                  </a>
                )}
              </div>
            )}

            {/* Form Inputs */}
            <form onSubmit={handleCreateEvent} className="flex flex-col gap-4">
              {/* 1. Event Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Event Name <span className="text-pink-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Neon Horizon Cyber Festival"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={txStatus === "waiting_signature" || txStatus === "mining"}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all ${
                    formErrors.name ? "border-rose-500/60" : "border-white/10 hover:border-white/20"
                  }`}
                />
                {formErrors.name && (
                  <p className="text-rose-400 text-xs mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* 2. Location */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Venue / Location <span className="text-pink-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-zinc-500">
                    <Icons.MapPin />
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Cyber Dome, Neo-Tokyo / Bangalore"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    disabled={txStatus === "waiting_signature" || txStatus === "mining"}
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-zinc-950/80 border text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all ${
                      formErrors.location
                        ? "border-rose-500/60"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  />
                </div>
                {formErrors.location && (
                  <p className="text-rose-400 text-xs mt-1">{formErrors.location}</p>
                )}
              </div>

              {/* 3. Event Date Picker */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Event Date & Time <span className="text-pink-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={form.eventDate}
                    onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                    disabled={txStatus === "waiting_signature" || txStatus === "mining"}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all [color-scheme:dark] ${
                      formErrors.eventDate
                        ? "border-rose-500/60"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  />
                </div>
                {formErrors.eventDate && (
                  <p className="text-rose-400 text-xs mt-1">{formErrors.eventDate}</p>
                )}
              </div>

              {/* 4. Ticket Price (ETH) & Total Tickets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Price (ETH) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Ticket Price (ETH) <span className="text-pink-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      placeholder="0.05"
                      value={form.ticketPrice}
                      onChange={(e) => setForm({ ...form, ticketPrice: e.target.value })}
                      disabled={txStatus === "waiting_signature" || txStatus === "mining"}
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all font-mono ${
                        formErrors.ticketPrice
                          ? "border-rose-500/60"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-mono font-bold text-pink-400">
                      ETH
                    </span>
                  </div>
                  {formErrors.ticketPrice && (
                    <p className="text-rose-400 text-xs mt-1">{formErrors.ticketPrice}</p>
                  )}
                </div>

                {/* Total Tickets Capacity */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Total Tickets <span className="text-pink-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="100"
                    value={form.totalTickets}
                    onChange={(e) => setForm({ ...form, totalTickets: e.target.value })}
                    disabled={txStatus === "waiting_signature" || txStatus === "mining"}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all font-mono ${
                      formErrors.totalTickets
                        ? "border-rose-500/60"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  />
                  {formErrors.totalTickets && (
                    <p className="text-rose-400 text-xs mt-1">{formErrors.totalTickets}</p>
                  )}
                </div>
              </div>

              {/* Protocol Anti-Scalp Info Box */}
              <div className="p-3.5 rounded-xl bg-pink-950/20 border border-pink-500/20 text-[11px] text-zinc-300 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-pink-400 font-bold">
                  <Icons.Sparkles />
                  <span>Validus Anti-Scalping Economics</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Max secondary resale price (1.5× cap):</span>
                  <span className="text-white font-mono font-semibold">
                    {form.ticketPrice && !isNaN(parseFloat(form.ticketPrice))
                      ? `${(parseFloat(form.ticketPrice) * 1.5).toFixed(4)} ETH`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Organizer secondary royalty:</span>
                  <span className="text-pink-400 font-mono font-semibold">5% per transfer</span>
                </div>
              </div>

              {/* Dynamic Action Button */}
              {!account ? (
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={isConnectingWallet}
                  className="mt-2 w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all shadow-[0_0_20px_rgba(236,72,153,0.35)] hover:shadow-[0_0_30px_rgba(236,72,153,0.55)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Icons.Wallet />
                  <span>Connect MetaMask to Deploy</span>
                </button>
              ) : isWrongNetwork ? (
                <button
                  type="button"
                  onClick={switchOrAddSepolia}
                  className="mt-2 w-full py-3.5 rounded-xl font-bold text-sm text-white bg-rose-500 hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/30 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Icons.AlertTriangle />
                  <span>Switch to Sepolia Network</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={txStatus === "waiting_signature" || txStatus === "mining"}
                  className="mt-2 w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all shadow-[0_0_20px_rgba(236,72,153,0.35)] hover:shadow-[0_0_30px_rgba(236,72,153,0.55)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {txStatus === "waiting_signature" ? (
                    <>
                      <Icons.Spinner />
                      <span>Confirm in MetaMask...</span>
                    </>
                  ) : txStatus === "mining" ? (
                    <>
                      <Icons.Spinner />
                      <span>Deploying to Sepolia...</span>
                    </>
                  ) : (
                    <>
                      <Icons.Sparkles />
                      <span>Deploy Event On-Chain</span>
                    </>
                  )}
                </button>
              )}
            </form>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              RIGHT COLUMN: MY EVENTS LIST
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Header row with Filters & Refresh */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">My Events</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  {filteredEvents.length}
                </span>
              </div>

              {/* Filter Tabs & Refresh */}
              <div className="flex items-center gap-2">
                <div className="flex items-center p-1 rounded-xl bg-zinc-950/80 border border-white/10 text-xs">
                  {(["all", "active", "soldout", "past"] as const).map((filterKey) => (
                    <button
                      key={filterKey}
                      type="button"
                      onClick={() => setEventFilter(filterKey)}
                      className={`px-3 py-1 rounded-lg capitalize transition-all ${
                        eventFilter === filterKey
                          ? "bg-pink-500 text-white font-bold shadow-sm"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {filterKey}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => account && loadOrganizerEvents(account)}
                  disabled={isLoadingEvents || !account}
                  title="Refresh events from Sepolia"
                  className="p-2 rounded-xl bg-zinc-950/80 border border-white/10 text-zinc-400 hover:text-white hover:border-pink-500/40 transition-all disabled:opacity-40"
                >
                  <span className={isLoadingEvents ? "animate-spin block" : ""}>
                    <Icons.Refresh />
                  </span>
                </button>
              </div>
            </div>

            {/* Empty State */}
            {!account ? (
              <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-white/10 flex flex-col items-center justify-center gap-3">
                <div className="size-14 rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center justify-center">
                  <Icons.Wallet />
                </div>
                <h3 className="text-base font-bold text-white">Connect Your Wallet</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Connect MetaMask to load your smart contract events and inspect real-time sales
                  metrics.
                </p>
                <button
                  type="button"
                  onClick={connectWallet}
                  className="mt-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-pink-500 hover:bg-pink-600 transition-all"
                >
                  Connect MetaMask
                </button>
              </div>
            ) : isLoadingEvents && events.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-white/10 flex flex-col items-center justify-center gap-3">
                <Icons.Spinner />
                <p className="text-sm text-zinc-400">Querying Sepolia blockchain for your events...</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-white/10 flex flex-col items-center justify-center gap-3">
                <div className="size-14 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center justify-center">
                  <Icons.Ticket />
                </div>
                <h3 className="text-base font-bold text-white">No Events Found</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  {eventFilter === "all"
                    ? "You haven't deployed any events yet. Fill out the form on the left to deploy your first NFT ticket collection!"
                    : `No events match the "${eventFilter}" filter.`}
                </p>
              </div>
            ) : (
              /* Events Card Grid */
              <div className="flex flex-col gap-4">
                {filteredEvents.map((ev) => {
                  const sold = Number(ev.ticketsSold);
                  const total = Number(ev.totalTickets);
                  const remaining = Math.max(0, total - sold);
                  const priceEth = Number(ethers.formatEther(ev.ticketPrice));
                  const progress = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0;
                  const isSoldOut = sold >= total;
                  const isPast = ev.eventDate * 1000 < Date.now();
                  const eventDateStr = new Date(ev.eventDate * 1000).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  // Individual event 5% revenue calculation
                  const eventRoyaltyEth = (sold * priceEth * 0.05).toFixed(4);

                  return (
                    <div
                      key={ev.eventId}
                      className="group relative p-5 rounded-2xl bg-zinc-900/80 border border-white/10 hover:border-pink-500/40 transition-all shadow-lg hover:shadow-[0_0_25px_rgba(236,72,153,0.15)] backdrop-blur-md"
                    >
                      {/* Top Row: Event Name & Status Badge */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white group-hover:text-pink-300 transition-colors">
                              {ev.name}
                            </h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/10">
                              ID #{ev.eventId}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Icons.MapPin />
                              <span>{ev.location}</span>
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span className="flex items-center gap-1">
                              <Icons.Calendar />
                              <span>{eventDateStr}</span>
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            isSoldOut
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                              : isPast
                              ? "bg-zinc-800 border-zinc-700 text-zinc-400"
                              : ev.active
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                          }`}
                        >
                          {isSoldOut ? "Sold Out" : isPast ? "Past Event" : ev.active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Middle Stats Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-zinc-950/60 border border-white/5 my-3.5">
                        {/* Primary Price */}
                        <div>
                          <span className="text-[10px] text-zinc-400 block font-medium">Ticket Price</span>
                          <span className="text-sm font-bold text-white font-mono">
                            {priceEth} <span className="text-xs text-pink-400">ETH</span>
                          </span>
                        </div>

                        {/* Tickets Sold / Total */}
                        <div>
                          <span className="text-[10px] text-zinc-400 block font-medium">Tickets Sold</span>
                          <span className="text-sm font-bold text-white font-mono">
                            {sold} <span className="text-xs text-zinc-400">/ {total}</span>
                          </span>
                        </div>

                        {/* Remaining */}
                        <div>
                          <span className="text-[10px] text-zinc-400 block font-medium">Remaining</span>
                          <span className="text-sm font-bold text-pink-400 font-mono">
                            {remaining} left
                          </span>
                        </div>

                        {/* Royalty Earned (tickets sold × price × 5%) */}
                        <div>
                          <span className="text-[10px] text-zinc-400 block font-medium">5% Royalty</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            {eventRoyaltyEth} <span className="text-[10px]">ETH</span>
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between items-center text-xs mb-1.5 font-mono">
                          <span className="text-zinc-400 text-[11px]">Sales Progress</span>
                          <span className="text-pink-400 font-bold">{progress}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Card Footer: Resale cap & Etherscan contract info */}
                      <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                        <span>
                          Resale Capped at:{" "}
                          <strong className="text-zinc-200 font-mono">{(priceEth * 1.5).toFixed(4)} ETH</strong>
                        </span>
                        {ev.txHash ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${ev.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-400 hover:underline"
                            title="View deployment transaction on Sepolia Etherscan"
                          >
                            <span>Deployment Tx</span>
                            <Icons.ExternalLink />
                          </a>
                        ) : (
                          <a
                            href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-pink-400 hover:underline"
                          >
                            <span>Contract Call</span>
                            <Icons.ExternalLink />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ─── Contract Configuration Modal ─── */}
      {isContractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-white/15 shadow-2xl relative">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>ValidusTicket Sepolia Contract</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsContractModalOpen(false)}
                className="text-zinc-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Set the Sepolia contract address for <code className="text-pink-300 bg-pink-950/40 px-1 py-0.5 rounded">ValidusTicket</code>. Events will be fetched live via <code className="text-pink-300">getEventDetails()</code>.
            </p>
            <label className="text-[11px] text-zinc-300 font-medium block mb-1.5">
              Contract Address (0x...)
            </label>
            <input
              type="text"
              value={customContractInput}
              onChange={(e) => setCustomContractInput(e.target.value)}
              placeholder="0x..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-pink-500 mb-5"
            />
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const def = DEFAULT_CONTRACT_ADDRESS;
                  setCustomContractInput(def);
                }}
                className="mr-auto text-[11px] text-zinc-400 hover:text-zinc-200 underline"
              >
                Reset default
              </button>
              <button
                type="button"
                onClick={() => setIsContractModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const trimmed = customContractInput.trim();
                  if (trimmed && trimmed.startsWith("0x")) {
                    setContractAddress(trimmed);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("validus_contract_address", trimmed);
                      localStorage.setItem(
                        "validus_contract_address_version",
                        CONTRACT_ADDRESS_STORAGE_VERSION
                      );
                    }
                    setIsContractModalOpen(false);
                    setLiveNotification({
                      type: "info",
                      message: `Target contract updated to ${shortenAddress(trimmed)}`,
                    });
                    if (account) {
                      loadOrganizerEvents(account, trimmed);
                    }
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-pink-500 hover:bg-pink-600 text-white shadow-md shadow-pink-500/20 transition-all active:scale-95"
              >
                Save & Query Events
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
