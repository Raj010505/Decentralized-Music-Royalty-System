import { isAddress } from "ethers";

const fallbackAddresses = {
  MusicRightsNFT: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  RoyaltyManager: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  RightsAuction: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
} as const;

function pickAddress(value: string | undefined, fallback: string): string {
  if (value && isAddress(value)) {
    return value;
  }

  return fallback;
}

function parseChainId(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const TARGET_CHAIN_ID = parseChainId(process.env.NEXT_PUBLIC_CHAIN_ID, 31337);
export const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME || "Hardhat Local";
export const LOCAL_RPC_URL = process.env.NEXT_PUBLIC_LOCAL_RPC_URL || "http://127.0.0.1:8545";

export const CONTRACT_ADDRESSES = {
  MusicRightsNFT: pickAddress(
    process.env.NEXT_PUBLIC_MUSIC_RIGHTS_NFT,
    fallbackAddresses.MusicRightsNFT
  ),
  RoyaltyManager: pickAddress(
    process.env.NEXT_PUBLIC_ROYALTY_MANAGER,
    fallbackAddresses.RoyaltyManager
  ),
  RightsAuction: pickAddress(process.env.NEXT_PUBLIC_RIGHTS_AUCTION, fallbackAddresses.RightsAuction),
} as const;

export function hasValidContractAddresses(): boolean {
  return Object.values(CONTRACT_ADDRESSES).every((value) => isAddress(value));
}
