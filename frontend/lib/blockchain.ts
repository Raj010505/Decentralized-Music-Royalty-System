import { BrowserProvider, JsonRpcProvider } from "ethers";
import { LOCAL_RPC_URL, NETWORK_NAME, TARGET_CHAIN_ID } from "./addresses";

const CUSTOM_ERROR_HINTS: Record<string, string> = {
  ArrayLengthMismatch: "Split accounts and split percentages must have the same length.",
  InvalidBpsTotal: "Royalty split must total exactly 100% (10,000 bps).",
  InvalidSplit: "One or more split entries is invalid. Check wallet addresses and bps values.",
  InvalidRightsHolder:
    "Rights holder index is invalid or the selected rights holder address does not match the caller.",
  InvalidRatePerPlay: "Rate per play must be greater than zero.",
  InvalidPlays: "Play count must be greater than zero.",
  TrackNotFound: "This token ID is not registered as a track yet.",
  InsufficientPayment: "Payment is lower than required for the selected number of plays.",
  NotAuction: "Only the auction contract can update rights holder ownership.",
  AuctionNotActive: "Auction is not active for this token.",
  AuctionStillRunning: "Auction cannot be finalized before the end time.",
  AuctionEnded: "Auction already ended. Wait for finalize or start a new listing.",
  BidTooLow: "Bid amount is too low for the current auction state.",
  NotSeller: "Only the NFT owner/seller can perform this action.",
  AuctionHasBids: "Auction cannot be canceled once bids exist.",
  NothingToWithdraw: "No refundable bid balance is available for this wallet.",
  NotRoyaltyManager: "Only the royalty manager contract can mint track NFTs.",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return null;
}

function pushTextCandidate(target: string[], value: unknown) {
  if (typeof value === "string" && value.trim()) {
    target.push(value.trim());
  }
}

function extractTextCandidates(error: unknown): string[] {
  if (typeof error === "string") {
    return [error.trim()];
  }

  const result: string[] = [];
  const root = asRecord(error);
  if (!root) {
    return result;
  }

  pushTextCandidate(result, root.shortMessage);
  pushTextCandidate(result, root.reason);
  pushTextCandidate(result, root.message);

  const nestedKeys = ["error", "data", "info", "cause"] as const;
  for (const key of nestedKeys) {
    const nested = asRecord(root[key]);
    if (!nested) {
      continue;
    }

    pushTextCandidate(result, nested.shortMessage);
    pushTextCandidate(result, nested.reason);
    pushTextCandidate(result, nested.message);

    const nestedError = asRecord(nested.error);
    if (nestedError) {
      pushTextCandidate(result, nestedError.message);
      pushTextCandidate(result, nestedError.reason);
    }
  }

  return result;
}

function getNumericCode(error: unknown): number | null {
  const root = asRecord(error);
  if (!root || !("code" in root)) {
    return null;
  }

  const raw = root.code;
  if (typeof raw === "number") {
    return raw;
  }

  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function decodeTextMessage(message: string): string | null {
  const lowercase = message.toLowerCase();

  for (const [customErrorName, hint] of Object.entries(CUSTOM_ERROR_HINTS)) {
    if (message.includes(customErrorName)) {
      return hint;
    }
  }

  if (lowercase.includes("user rejected") || lowercase.includes("rejected the request")) {
    return "Transaction was rejected in MetaMask.";
  }

  if (lowercase.includes("insufficient funds")) {
    return "Wallet has insufficient ETH for value + gas. Use a funded local Hardhat account.";
  }

  if (lowercase.includes("nonce too low")) {
    return "Nonce is too low. Reset the MetaMask account nonce or retry after pending transactions confirm.";
  }

  if (lowercase.includes("already known")) {
    return "This transaction is already pending in the mempool. Wait for confirmation or speed it up in MetaMask.";
  }

  if (lowercase.includes("failed to fetch") || lowercase.includes("networkerror")) {
    return "Unable to reach local RPC. Make sure Hardhat node is running at http://127.0.0.1:8545.";
  }

  if (lowercase.includes("execution reverted")) {
    return "Contract call reverted. Check the action prerequisites and current contract state.";
  }

  return null;
}

export interface EthereumProvider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function getInjectedProvider(): EthereumProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.ethereum ?? null;
}

export function getRpcProvider(): JsonRpcProvider {
  return new JsonRpcProvider(LOCAL_RPC_URL);
}

export function getBrowserProvider(): BrowserProvider {
  const injected = getInjectedProvider();

  if (!injected) {
    throw new Error("MetaMask was not found. Install the extension and reload this page.");
  }

  return new BrowserProvider(injected);
}

export async function switchToHardhatNetwork(): Promise<void> {
  const injected = getInjectedProvider();

  if (!injected) {
    throw new Error("MetaMask was not found.");
  }

  const targetHex = `0x${TARGET_CHAIN_ID.toString(16)}`;

  try {
    await injected.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetHex }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? Number((error as { code: unknown }).code)
        : NaN;

    if (code === 4902) {
      await injected.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: targetHex,
            chainName: NETWORK_NAME,
            nativeCurrency: {
              name: "Ether",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: [LOCAL_RPC_URL],
          },
        ],
      });

      return;
    }

    throw error;
  }
}

export function normalizeError(error: unknown): string {
  if (!error) {
    return "Unknown error";
  }

  const code = getNumericCode(error);

  if (code === 4001) {
    return "Transaction was rejected in MetaMask.";
  }

  if (code === 4902) {
    return "Hardhat Local network is missing in MetaMask. Use the network switch button and approve adding it.";
  }

  const textCandidates = extractTextCandidates(error);
  for (const text of textCandidates) {
    const decoded = decodeTextMessage(text);
    if (decoded) {
      return decoded;
    }
  }

  if (textCandidates.length > 0) {
    return textCandidates[0];
  }

  return String(error);
}
