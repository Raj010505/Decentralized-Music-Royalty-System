import { Contract } from "ethers";
import { CONTRACT_ADDRESSES } from "./addresses";
import { getBrowserProvider, getRpcProvider, switchToHardhatNetwork } from "./blockchain";

export const musicRightsNftAbi = [
  "function approve(address to, uint256 tokenId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

export const royaltyManagerAbi = [
  "function registerTrack(string title, string metadataURI, address[] splitAccounts, uint96[] splitBps, uint256 rightsHolderSplitIndex, uint256 ratePerPlayWei) returns (uint256)",
  "function getTrackInfo(uint256 tokenId) view returns ((string title, uint256 ratePerPlayWei, uint256 totalPlays, uint256 totalRoyaltyPaidWei, uint256 rightsHolderSplitIndex, bool exists))",
  "function getTrackSplits(uint256 tokenId) view returns (address[] accounts, uint96[] bps)",
  "function quoteRoyaltyDistribution(uint256 tokenId, uint256 plays) view returns (uint256 totalCost, address[] recipients, uint256[] amounts)",
  "function simulatePlays(uint256 tokenId, uint256 plays) payable",
  "function rightsHolderOf(uint256 tokenId) view returns (address)",
  "event TrackRegistered(uint256 indexed tokenId, address indexed rightsHolder, string title, string metadataURI, uint256 ratePerPlayWei)",
  "event RoyaltySplitPaid(uint256 indexed tokenId, address indexed recipient, uint256 amountWei, uint256 plays)",
  "event RoyaltiesDistributed(uint256 indexed tokenId, uint256 plays, uint256 totalPaidWei, address indexed paidBy)",
  "event RightsHolderUpdated(uint256 indexed tokenId, address indexed newRightsHolder)",
];

export const rightsAuctionAbi = [
  "function createAuction(uint256 tokenId, uint256 minBidWei, uint256 durationSeconds)",
  "function placeBid(uint256 tokenId) payable",
  "function finalizeAuction(uint256 tokenId)",
  "function cancelAuction(uint256 tokenId)",
  "function withdrawRefund()",
  "function pendingReturns(address account) view returns (uint256)",
  "function getAuction(uint256 tokenId) view returns ((address seller, uint256 minBidWei, uint256 endTime, address highestBidder, uint256 highestBidWei, bool active))",
  "event AuctionCreated(uint256 indexed tokenId, address indexed seller, uint256 minBidWei, uint256 endTime)",
  "event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 bidWei)",
  "event AuctionFinalized(uint256 indexed tokenId, address indexed seller, address indexed winner, uint256 finalBidWei)",
  "event AuctionCancelled(uint256 indexed tokenId, address indexed seller)",
  "event BidRefunded(address indexed bidder, uint256 amountWei)",
];

export function getReadContracts() {
  const provider = getRpcProvider();

  return {
    provider,
    musicRightsNft: new Contract(CONTRACT_ADDRESSES.MusicRightsNFT, musicRightsNftAbi, provider),
    royaltyManager: new Contract(CONTRACT_ADDRESSES.RoyaltyManager, royaltyManagerAbi, provider),
    rightsAuction: new Contract(CONTRACT_ADDRESSES.RightsAuction, rightsAuctionAbi, provider),
  };
}

export async function getWriteContracts() {
  await switchToHardhatNetwork();

  const browserProvider = getBrowserProvider();
  const signer = await browserProvider.getSigner();

  return {
    browserProvider,
    signer,
    musicRightsNft: new Contract(CONTRACT_ADDRESSES.MusicRightsNFT, musicRightsNftAbi, signer),
    royaltyManager: new Contract(CONTRACT_ADDRESSES.RoyaltyManager, royaltyManagerAbi, signer),
    rightsAuction: new Contract(CONTRACT_ADDRESSES.RightsAuction, rightsAuctionAbi, signer),
  };
}
