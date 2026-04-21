import { Interface } from "ethers";
import { CONTRACT_ADDRESSES } from "./addresses";
import { getRpcProvider } from "./blockchain";
import { musicRightsNftAbi, rightsAuctionAbi, royaltyManagerAbi } from "./contracts";

export type ActivityDirection = "incoming" | "outgoing" | "neutral";

export interface ActivityItem {
  id: string;
  eventName: string;
  description: string;
  contractLabel: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  occurredAt: string;
  tokenId?: bigint;
  amountWei?: bigint;
  actor?: string;
  counterparty?: string;
  direction: ActivityDirection;
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(String(value));
}

function isRelatedAddress(target: string | undefined, normalizedWallet: string | null): boolean {
  if (!target || !normalizedWallet) {
    return false;
  }

  return target.toLowerCase() === normalizedWallet;
}

export async function fetchActivityFeed(walletAddress?: string): Promise<ActivityItem[]> {
  const provider = getRpcProvider();
  const normalizedWallet = walletAddress ? walletAddress.toLowerCase() : null;

  const royaltyInterface = new Interface(royaltyManagerAbi);
  const auctionInterface = new Interface(rightsAuctionAbi);
  const nftInterface = new Interface(musicRightsNftAbi);

  const blockTimeCache = new Map<number, string>();

  async function getOccurredAt(blockNumber: number): Promise<string> {
    const existing = blockTimeCache.get(blockNumber);
    if (existing) {
      return existing;
    }

    const block = await provider.getBlock(blockNumber);
    const occurredAt = block
      ? new Date(Number(block.timestamp) * 1000).toISOString()
      : new Date(0).toISOString();

    blockTimeCache.set(blockNumber, occurredAt);
    return occurredAt;
  }

  const items: ActivityItem[] = [];

  async function collect(args: {
    contractLabel: string;
    contractAddress: string;
    interfaceInstance: Interface;
    eventName: string;
    parser: (parsedArgs: Record<string, unknown>) => {
      description: string;
      direction: ActivityDirection;
      tokenId?: bigint;
      amountWei?: bigint;
      actor?: string;
      counterparty?: string;
      relatedAddresses: string[];
    };
  }) {
    const eventFragment = args.interfaceInstance.getEvent(args.eventName);
    if (!eventFragment) {
      return;
    }

    const logs = await provider.getLogs({
      address: args.contractAddress,
      fromBlock: 0,
      toBlock: "latest",
      topics: [eventFragment.topicHash],
    });

    for (const log of logs) {
      const parsed = args.interfaceInstance.parseLog(log);
      if (!parsed) {
        continue;
      }

      const parsedArgs = parsed.args as unknown as Record<string, unknown>;
      const parsedItem = args.parser(parsedArgs);

      if (
        normalizedWallet &&
        !parsedItem.relatedAddresses.some((entry) => entry.toLowerCase() === normalizedWallet)
      ) {
        continue;
      }

      const occurredAt = await getOccurredAt(log.blockNumber);

      items.push({
        id: `${log.transactionHash}-${log.index}-${args.eventName}`,
        eventName: args.eventName,
        description: parsedItem.description,
        contractLabel: args.contractLabel,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.index,
        occurredAt,
        tokenId: parsedItem.tokenId,
        amountWei: parsedItem.amountWei,
        actor: parsedItem.actor,
        counterparty: parsedItem.counterparty,
        direction: parsedItem.direction,
      });
    }
  }

  await collect({
    contractLabel: "RoyaltyManager",
    contractAddress: CONTRACT_ADDRESSES.RoyaltyManager,
    interfaceInstance: royaltyInterface,
    eventName: "TrackRegistered",
    parser: (entry) => {
      const rightsHolder = String(entry.rightsHolder);
      const title = String(entry.title);
      const tokenId = toBigInt(entry.tokenId);

      return {
        description: `Registered track \"${title}\"`,
        tokenId,
        actor: rightsHolder,
        counterparty: rightsHolder,
        direction: isRelatedAddress(rightsHolder, normalizedWallet) ? "outgoing" : "neutral",
        relatedAddresses: [rightsHolder],
      };
    },
  });

  await collect({
    contractLabel: "RoyaltyManager",
    contractAddress: CONTRACT_ADDRESSES.RoyaltyManager,
    interfaceInstance: royaltyInterface,
    eventName: "RoyaltySplitPaid",
    parser: (entry) => {
      const recipient = String(entry.recipient);
      const tokenId = toBigInt(entry.tokenId);
      const amountWei = toBigInt(entry.amountWei);
      const plays = toBigInt(entry.plays);

      return {
        description: `Split payout for ${plays.toString()} plays`,
        tokenId,
        amountWei,
        actor: recipient,
        counterparty: recipient,
        direction: isRelatedAddress(recipient, normalizedWallet) ? "incoming" : "neutral",
        relatedAddresses: [recipient],
      };
    },
  });

  await collect({
    contractLabel: "RoyaltyManager",
    contractAddress: CONTRACT_ADDRESSES.RoyaltyManager,
    interfaceInstance: royaltyInterface,
    eventName: "RoyaltiesDistributed",
    parser: (entry) => {
      const paidBy = String(entry.paidBy);
      const tokenId = toBigInt(entry.tokenId);
      const amountWei = toBigInt(entry.totalPaidWei);
      const plays = toBigInt(entry.plays);

      return {
        description: `Simulated stream payment (${plays.toString()} plays)`,
        tokenId,
        amountWei,
        actor: paidBy,
        counterparty: paidBy,
        direction: isRelatedAddress(paidBy, normalizedWallet) ? "outgoing" : "neutral",
        relatedAddresses: [paidBy],
      };
    },
  });

  await collect({
    contractLabel: "RightsAuction",
    contractAddress: CONTRACT_ADDRESSES.RightsAuction,
    interfaceInstance: auctionInterface,
    eventName: "AuctionCreated",
    parser: (entry) => {
      const seller = String(entry.seller);
      const tokenId = toBigInt(entry.tokenId);

      return {
        description: "Opened a rights auction",
        tokenId,
        actor: seller,
        counterparty: seller,
        direction: isRelatedAddress(seller, normalizedWallet) ? "outgoing" : "neutral",
        relatedAddresses: [seller],
      };
    },
  });

  await collect({
    contractLabel: "RightsAuction",
    contractAddress: CONTRACT_ADDRESSES.RightsAuction,
    interfaceInstance: auctionInterface,
    eventName: "BidPlaced",
    parser: (entry) => {
      const bidder = String(entry.bidder);
      const tokenId = toBigInt(entry.tokenId);
      const amountWei = toBigInt(entry.bidWei);

      return {
        description: "Placed auction bid",
        tokenId,
        amountWei,
        actor: bidder,
        counterparty: bidder,
        direction: isRelatedAddress(bidder, normalizedWallet) ? "outgoing" : "neutral",
        relatedAddresses: [bidder],
      };
    },
  });

  await collect({
    contractLabel: "RightsAuction",
    contractAddress: CONTRACT_ADDRESSES.RightsAuction,
    interfaceInstance: auctionInterface,
    eventName: "BidRefunded",
    parser: (entry) => {
      const bidder = String(entry.bidder);
      const amountWei = toBigInt(entry.amountWei);

      return {
        description: "Received bid refund",
        amountWei,
        actor: bidder,
        counterparty: bidder,
        direction: isRelatedAddress(bidder, normalizedWallet) ? "incoming" : "neutral",
        relatedAddresses: [bidder],
      };
    },
  });

  await collect({
    contractLabel: "RightsAuction",
    contractAddress: CONTRACT_ADDRESSES.RightsAuction,
    interfaceInstance: auctionInterface,
    eventName: "AuctionFinalized",
    parser: (entry) => {
      const seller = String(entry.seller);
      const winner = String(entry.winner);
      const tokenId = toBigInt(entry.tokenId);
      const amountWei = toBigInt(entry.finalBidWei);

      let direction: ActivityDirection = "neutral";
      if (isRelatedAddress(seller, normalizedWallet)) {
        direction = "incoming";
      }

      return {
        description: winner === "0x0000000000000000000000000000000000000000" ? "Auction ended with no bids" : "Auction finalized",
        tokenId,
        amountWei,
        actor: seller,
        counterparty: winner,
        direction,
        relatedAddresses: [seller, winner],
      };
    },
  });

  await collect({
    contractLabel: "MusicRightsNFT",
    contractAddress: CONTRACT_ADDRESSES.MusicRightsNFT,
    interfaceInstance: nftInterface,
    eventName: "Transfer",
    parser: (entry) => {
      const from = String(entry.from);
      const to = String(entry.to);
      const tokenId = toBigInt(entry.tokenId);

      let direction: ActivityDirection = "neutral";
      if (isRelatedAddress(to, normalizedWallet)) {
        direction = "incoming";
      } else if (isRelatedAddress(from, normalizedWallet)) {
        direction = "outgoing";
      }

      return {
        description: "NFT rights transfer",
        tokenId,
        actor: from,
        counterparty: to,
        direction,
        relatedAddresses: [from, to],
      };
    },
  });

  items.sort((a, b) => {
    if (b.blockNumber !== a.blockNumber) {
      return b.blockNumber - a.blockNumber;
    }

    return b.logIndex - a.logIndex;
  });

  return items;
}
