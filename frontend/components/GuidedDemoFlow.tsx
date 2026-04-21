"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeError } from "@/lib/blockchain";
import { getReadContracts } from "@/lib/contracts";
import { formatDateTime, formatEth, shortAddress } from "@/lib/format";
import { useWallet } from "./WalletProvider";

const DEMO_TOKEN_ID = 1n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface DemoSnapshot {
  tokenExists: boolean;
  owner: string;
  rightsHolder: string;
  totalPlays: bigint;
  totalRoyaltyPaidWei: bigint;
  auctionExists: boolean;
  auctionActive: boolean;
  auctionEndTime: bigint;
  highestBidder: string;
  highestBidWei: bigint;
}

const initialSnapshot: DemoSnapshot = {
  tokenExists: false,
  owner: ZERO_ADDRESS,
  rightsHolder: ZERO_ADDRESS,
  totalPlays: 0n,
  totalRoyaltyPaidWei: 0n,
  auctionExists: false,
  auctionActive: false,
  auctionEndTime: 0n,
  highestBidder: ZERO_ADDRESS,
  highestBidWei: 0n,
};

export default function GuidedDemoFlow() {
  const { address } = useWallet();

  const [snapshot, setSnapshot] = useState<DemoSnapshot>(initialSnapshot);
  const [pendingRefund, setPendingRefund] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadStatus = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const { musicRightsNft, royaltyManager, rightsAuction } = getReadContracts();

        let owner = ZERO_ADDRESS;
        let rightsHolder = ZERO_ADDRESS;
        let totalPlays = 0n;
        let totalRoyaltyPaidWei = 0n;
        let tokenExists = false;

        try {
          owner = (await musicRightsNft.ownerOf(DEMO_TOKEN_ID)) as string;
          tokenExists = true;
        } catch {
          setSnapshot(initialSnapshot);
          setPendingRefund(0n);
          setLastUpdated(new Date().toISOString());
          setError(null);
          return;
        }

        const trackInfo = await royaltyManager.getTrackInfo(DEMO_TOKEN_ID);
        rightsHolder = (await royaltyManager.rightsHolderOf(DEMO_TOKEN_ID)) as string;
        totalPlays = trackInfo.totalPlays as bigint;
        totalRoyaltyPaidWei = trackInfo.totalRoyaltyPaidWei as bigint;

        const auction = await rightsAuction.getAuction(DEMO_TOKEN_ID);
        const auctionSeller = (auction.seller as string) || ZERO_ADDRESS;

        let nextPendingRefund = 0n;
        if (address) {
          nextPendingRefund = (await rightsAuction.pendingReturns(address)) as bigint;
        }

        setSnapshot({
          tokenExists,
          owner,
          rightsHolder,
          totalPlays,
          totalRoyaltyPaidWei,
          auctionExists: auctionSeller.toLowerCase() !== ZERO_ADDRESS,
          auctionActive: auction.active as boolean,
          auctionEndTime: auction.endTime as bigint,
          highestBidder: auction.highestBidder as string,
          highestBidWei: auction.highestBidWei as bigint,
        });

        setPendingRefund(nextPendingRefund);
        setLastUpdated(new Date().toISOString());
        setError(null);
      } catch (runtimeError) {
        if (!silent) {
          setError(normalizeError(runtimeError));
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [address]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadStatus(true);
    }, 12000);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefresh, loadStatus]);

  const steps = useMemo(
    () => [
      {
        label: "Token #1 is registered",
        done: snapshot.tokenExists,
        description: "Register a track if this is false.",
      },
      {
        label: "At least 1,000 plays simulated",
        done: snapshot.totalPlays >= 1000n,
        description: "Use Stream Sim page and run 1000 plays.",
      },
      {
        label: "Auction created for token #1",
        done: snapshot.auctionExists,
        description: "List token #1 in Auctions page.",
      },
      {
        label: "At least one bid placed",
        done: snapshot.highestBidWei > 0n,
        description: "Place a bid from another account.",
      },
      {
        label: "Auction finalized and rights transferred",
        done:
          snapshot.auctionExists &&
          !snapshot.auctionActive &&
          snapshot.highestBidder !== ZERO_ADDRESS &&
          snapshot.owner.toLowerCase() === snapshot.rightsHolder.toLowerCase() &&
          snapshot.owner.toLowerCase() === snapshot.highestBidder.toLowerCase(),
        description: "Finalize after end time and verify owner/rights holder changed.",
      },
    ],
    [snapshot]
  );

  const completedSteps = steps.filter((entry) => entry.done).length;

  return (
    <section className="panel stack-md">
      <div className="row-between">
        <div className="stack-xs">
          <h3 className="panel-title">Guided End-to-End Demo</h3>
          <p className="muted">
            Follow these steps to complete the local proof flow: register, simulate streams, auction rights,
            and verify transferred future royalties.
          </p>
        </div>

        <div className="actions-row">
          <button className="btn-secondary" onClick={() => void loadStatus()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Status"}
          </button>
          <button className="btn-ghost" onClick={() => setAutoRefresh((value) => !value)}>
            Auto Refresh: {autoRefresh ? "On" : "Off"}
          </button>
        </div>
      </div>

      <p className="muted">
        Progress: {completedSteps}/{steps.length} steps complete
        {lastUpdated ? ` | Updated: ${formatDateTime(lastUpdated)}` : ""}
      </p>

      <div className="demo-step-list">
        {steps.map((step) => (
          <div key={step.label} className={step.done ? "demo-step demo-step-done" : "demo-step"}>
            <span className={step.done ? "step-bullet step-bullet-done" : "step-bullet"}>
              {step.done ? "Done" : "Todo"}
            </span>
            <div className="stack-xs">
              <p className="step-title">{step.label}</p>
              <p className="muted tiny">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="demo-grid">
        <p>
          <strong>Owner:</strong> {shortAddress(snapshot.owner)}
        </p>
        <p>
          <strong>Rights holder:</strong> {shortAddress(snapshot.rightsHolder)}
        </p>
        <p>
          <strong>Total plays:</strong> {snapshot.totalPlays.toString()}
        </p>
        <p>
          <strong>Total royalties paid:</strong> {formatEth(snapshot.totalRoyaltyPaidWei)} ETH
        </p>
        <p>
          <strong>Auction active:</strong> {snapshot.auctionActive ? "Yes" : "No"}
        </p>
        <p>
          <strong>Highest bid:</strong> {formatEth(snapshot.highestBidWei)} ETH
        </p>
        <p>
          <strong>Highest bidder:</strong> {shortAddress(snapshot.highestBidder)}
        </p>
        <p>
          <strong>My pending refund:</strong> {formatEth(pendingRefund)} ETH
        </p>
        <p>
          <strong>Auction ends:</strong>{" "}
          {snapshot.auctionEndTime > 0n
            ? formatDateTime(new Date(Number(snapshot.auctionEndTime) * 1000).toISOString())
            : "-"}
        </p>
      </div>

      <div className="actions-row">
        <Link href="/register" className="btn-ghost">
          Step 1: Register Track
        </Link>
        <Link href="/stream" className="btn-ghost">
          Step 2: Simulate Plays
        </Link>
        <Link href="/auctions" className="btn-ghost">
          Step 3-4: Auction + Bids
        </Link>
        <Link href="/history" className="btn-ghost">
          Step 5: Review History
        </Link>
      </div>

      {error ? <div className="notice-error">{error}</div> : null}
    </section>
  );
}
