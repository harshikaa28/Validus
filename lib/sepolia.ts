import { ethers } from "ethers";

export const DEFAULT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xa64e9ed54034bd804c878844ce838153ecc796aa";
export const CONTRACT_ADDRESS_STORAGE_KEY = "validus_contract_address";
// Version bump forces any browser holding the old address in localStorage to reset.
export const CONTRACT_ADDRESS_STORAGE_VERSION = `5:${DEFAULT_CONTRACT_ADDRESS.toLowerCase()}`;

export const SEPOLIA_RPC_URLS = [
  "https://sepolia-rpc.ethereum.org",
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.gateway.tenderly.co",
];

export function getConfiguredContractAddress(): string {
  if (typeof window === "undefined") return DEFAULT_CONTRACT_ADDRESS;

  const storedVersion = localStorage.getItem("validus_contract_address_version");
  if (storedVersion !== CONTRACT_ADDRESS_STORAGE_VERSION) {
    localStorage.setItem(CONTRACT_ADDRESS_STORAGE_KEY, DEFAULT_CONTRACT_ADDRESS);
    localStorage.setItem("validus_contract_address_version", CONTRACT_ADDRESS_STORAGE_VERSION);
    return DEFAULT_CONTRACT_ADDRESS;
  }

  const savedAddress = localStorage.getItem(CONTRACT_ADDRESS_STORAGE_KEY);
  return savedAddress && ethers.isAddress(savedAddress) ? savedAddress : DEFAULT_CONTRACT_ADDRESS;
}

/**
 * Sleeps for `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if the error looks like an HTTP 429 Too Many Requests.
 */
function is429(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; code?: number | string; message?: string };
  if (e.status === 429) return true;
  if (typeof e.message === "string" && e.message.includes("429")) return true;
  return false;
}

/**
 * Attempts to connect to a single Sepolia RPC URL.
 * Retries up to `maxRetries` times on 429 with exponential backoff.
 */
async function tryRpc(
  url: string,
  maxRetries = 3,
): Promise<ethers.JsonRpcProvider> {
  let delay = 1_000; // 1 s initial backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const provider = new ethers.JsonRpcProvider(url, 11155111, { staticNetwork: true });
    try {
      await provider.getBlockNumber();
      return provider;
    } catch (error) {
      if (is429(error) && attempt < maxRetries) {
        console.warn(
          `Sepolia RPC ${url} returned 429 (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms…`,
        );
        await sleep(delay);
        delay *= 2; // exponential backoff: 1 s → 2 s → 4 s
        continue;
      }
      throw error;
    }
  }
  // TypeScript requires an explicit throw here even though the loop always returns or throws.
  throw new Error(`All retries exhausted for ${url}`);
}

/**
 * Returns the first responsive Sepolia JSON-RPC provider.
 * Tries each URL in SEPOLIA_RPC_URLS in order, with per-URL 429 retry backoff.
 */
export async function getSepoliaProvider(): Promise<ethers.JsonRpcProvider> {
  let lastError: unknown;

  for (const url of SEPOLIA_RPC_URLS) {
    try {
      return await tryRpc(url);
    } catch (error) {
      lastError = error;
      console.warn(`Sepolia RPC ${url} is unavailable; trying the next endpoint.`, error);
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : "No Sepolia RPC endpoint responded.";
  throw new Error(`Unable to connect to Sepolia. ${detail}`);
}
