"use client";

import { parseEther } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { CONTRACT_ADDRESSES } from "@/lib/addresses";
import { normalizeError } from "@/lib/blockchain";
import { getReadContracts, getWriteContracts } from "@/lib/contracts";
import { formatDateTime, formatEth, shortAddress, shortHash } from "@/lib/format";
import { useWallet } from "./WalletProvider";

interface AuctionSnapshot {
  tokenId: bigint;
  seller: string;
  minBidWei: bigint;
  endTime: bigint;
  highestBidder: string;
  highestBidWei: bigint;
  active: boolean;
  owner: string;
  rightsHolder: string;
}

export default function AuctionPanel() {
  const { address, isCorrectNetwork, connectWallet, switchNetwork } = useWallet();

  const [createTokenId, setCreateTokenId] = useState("1");
  const [createMinBidEth, setCreateMinBidEth] = useState("1");
  const [createDurationSeconds, setCreateDurationSeconds] = useState("3600");

  const [bidTokenId, setBidTokenId] = useState("1");
  const [bidAmountEth, setBidAmountEth] = useState("1.2");

  const [manageTokenId, setManageTokenId] = useState("1");
  const [pendingRefund, setPendingRefund] = useState<bigint>(0n);
  const [snapshot, setSnapshot] = useState<AuctionSnapshot | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [txHash, setTxHash] = useState<string | null>(null);

  const loadAuction = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoadingSnapshot(true);
      }

      try {
        const tokenId = BigInt(manageTokenId);
        const { rightsAuction, royaltyManager, musicRightsNft } = getReadContracts();

        const auction = await rightsAuction.getAuction(tokenId);
        const owner = await musicRightsNft.ownerOf(tokenId);
        const rightsHolder = await royaltyManager.rightsHolderOf(tokenId);

        const nextSnapshot: AuctionSnapshot = {
          tokenId,
          seller: auction.seller as string,
          minBidWei: auction.minBidWei as bigint,
          endTime: auction.endTime as bigint,
          highestBidder: auction.highestBidder as string,
          highestBidWei: auction.highestBidWei as bigint,
          active: auction.active as boolean,
          owner,
          rightsHolder,
        };

        setSnapshot(nextSnapshot);

        if (address) {
          const refund = await rightsAuction.pendingReturns(address);
          setPendingRefund(refund as bigint);
        } else {
          setPendingRefund(0n);
        }

        setLastUpdated(new Date().toISOString());
      } catch (runtimeError) {
        if (!silent) {
          setMessageType("error");
          setMessage(normalizeError(runtimeError));
        }
      } finally {
        if (!silent) {
          setLoadingSnapshot(false);
        }
      }
    },
    [address, manageTokenId]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAuction(true);
  }, [loadAuction]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadAuction(true);
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefresh, loadAuction]);

  async function ensureWalletReady() {
    if (!address) {
      await connectWallet();
      return false;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return false;
    }

    return true;
  }

  async function runAction(actionLabel: string, action: () => Promise<void>) {
    setBusyAction(actionLabel);
    setMessage(null);
    setTxHash(null);

    try {
      await action();
      setMessageType("success");
      setMessage(`${actionLabel} completed.`);
      await loadAuction(true);
    } catch (runtimeError) {
      setMessageType("error");
      setMessage(normalizeError(runtimeError));
    } finally {
      setBusyAction(null);
    }
  }

  async function createAuction() {
    const ready = await ensureWalletReady();
    if (!ready) {
      return;
    }

    await runAction("Create auction", async () => {
      const tokenId = BigInt(createTokenId);
      const minBid = parseEther(createMinBidEth);
      const durationSeconds = BigInt(createDurationSeconds);

      const { musicRightsNft, rightsAuction } = await getWriteContracts();

      const approveTx = await musicRightsNft.approve(CONTRACT_ADDRESSES.RightsAuction, tokenId);
      await approveTx.wait();

      const tx = await rightsAuction.createAuction(tokenId, minBid, durationSeconds);
      setTxHash(tx.hash);
      await tx.wait();

      setManageTokenId(createTokenId);
    });
  }

  async function placeBid() {
    const ready = await ensureWalletReady();
    if (!ready) {
      return;
    }

    await runAction("Place bid", async () => {
      const tokenId = BigInt(bidTokenId);
      const bidValue = parseEther(bidAmountEth);

      const { rightsAuction } = await getWriteContracts();
      const tx = await rightsAuction.placeBid(tokenId, { value: bidValue });
      setTxHash(tx.hash);
      await tx.wait();

      setManageTokenId(bidTokenId);
    });
  }

  async function finalizeAuction() {
    const ready = await ensureWalletReady();
    if (!ready) {
      return;
    }

    await runAction("Finalize auction", async () => {
      const tokenId = BigInt(manageTokenId);
      const { rightsAuction } = await getWriteContracts();
      const tx = await rightsAuction.finalizeAuction(tokenId);
      setTxHash(tx.hash);
      await tx.wait();
    });
  }

  async function cancelAuction() {
    const ready = await ensureWalletReady();
    if (!ready) {
      return;
    }

    await runAction("Cancel auction", async () => {
      const tokenId = BigInt(manageTokenId);
      const { rightsAuction } = await getWriteContracts();
      const tx = await rightsAuction.cancelAuction(tokenId);
      setTxHash(tx.hash);
      await tx.wait();
    });
  }

  async function withdrawRefund() {
    const ready = await ensureWalletReady();
    if (!ready) {
      return;
    }

    await runAction("Withdraw refund", async () => {
      const { rightsAuction } = await getWriteContracts();
      const tx = await rightsAuction.withdrawRefund();
      setTxHash(tx.hash);
      await tx.wait();
    });
  }

  return (
    <section className="stack-lg">
      <div className="panel stack-md">
        <h3 className="panel-title">Create Auction</h3>
        <div className="split-grid">
          <label className="field">
            <span>Token ID</span>
            <input className="input" value={createTokenId} onChange={(event) => setCreateTokenId(event.target.value)} />
          </label>

          <label className="field">
            <span>Minimum bid (ETH)</span>
            <input
              className="input"
              value={createMinBidEth}
              onChange={(event) => setCreateMinBidEth(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Duration (seconds)</span>
            <input
              className="input"
              value={createDurationSeconds}
              onChange={(event) => setCreateDurationSeconds(event.target.value)}
            />
          </label>
        </div>

        <button className="btn-primary" onClick={createAuction} disabled={Boolean(busyAction)}>
          {busyAction === "Create auction" ? "Working..." : "Approve + Create Auction"}
        </button>
      </div>

      <div className="panel stack-md">
        <h3 className="panel-title">Place Bid</h3>

        <div className="split-grid">
          <label className="field">
            <span>Token ID</span>
            <input className="input" value={bidTokenId} onChange={(event) => setBidTokenId(event.target.value)} />
          </label>

          <label className="field">
            <span>Bid amount (ETH)</span>
            <input className="input" value={bidAmountEth} onChange={(event) => setBidAmountEth(event.target.value)} />
          </label>
        </div>

        <button className="btn-secondary" onClick={placeBid} disabled={Boolean(busyAction)}>
          {busyAction === "Place bid" ? "Working..." : "Place Bid"}
        </button>
      </div>

      <div className="panel stack-md">
        <div className="row-between">
          <h3 className="panel-title">Manage Auction</h3>
          <div className="actions-row">
            <button className="btn-ghost" onClick={() => setAutoRefresh((value) => !value)}>
              Auto Refresh: {autoRefresh ? "On" : "Off"}
            </button>
            <button className="btn-ghost" onClick={() => void loadAuction()}>
              {loadingSnapshot ? "Refreshing..." : "Refresh Snapshot"}
            </button>
          </div>
        </div>

        {lastUpdated ? <p className="muted tiny">Last updated: {formatDateTime(lastUpdated)}</p> : null}

        <label className="field">
          <span>Token ID</span>
          <input className="input" value={manageTokenId} onChange={(event) => setManageTokenId(event.target.value)} />
        </label>

        <div className="actions-row">
          <button className="btn-secondary" onClick={finalizeAuction} disabled={Boolean(busyAction)}>
            {busyAction === "Finalize auction" ? "Working..." : "Finalize"}
          </button>

          <button className="btn-ghost" onClick={cancelAuction} disabled={Boolean(busyAction)}>
            {busyAction === "Cancel auction" ? "Working..." : "Cancel"}
          </button>

          <button className="btn-ghost" onClick={withdrawRefund} disabled={Boolean(busyAction)}>
            {busyAction === "Withdraw refund" ? "Working..." : `Withdraw Refund (${formatEth(pendingRefund)} ETH)`}
          </button>
        </div>

        {snapshot ? (
          <div className="snapshot-grid">
            <p>
              <strong>Seller:</strong> {shortAddress(snapshot.seller)}
            </p>
            <p>
              <strong>Highest bidder:</strong> {shortAddress(snapshot.highestBidder)}
            </p>
            <p>
              <strong>Highest bid:</strong> {formatEth(snapshot.highestBidWei)} ETH
            </p>
            <p>
              <strong>Min bid:</strong> {formatEth(snapshot.minBidWei)} ETH
            </p>
            <p>
              <strong>Auction active:</strong> {snapshot.active ? "Yes" : "No"}
            </p>
            <p>
              <strong>Ends:</strong>{" "}
              {snapshot.endTime > 0n
                ? formatDateTime(new Date(Number(snapshot.endTime) * 1000).toISOString())
                : "-"}
            </p>
            <p>
              <strong>NFT owner:</strong> {shortAddress(snapshot.owner)}
            </p>
            <p>
              <strong>Rights holder:</strong> {shortAddress(snapshot.rightsHolder)}
            </p>
          </div>
        ) : (
          <p className="muted">Load a token snapshot to inspect auction and rights status.</p>
        )}
      </div>

      {message ? (
        <div className={messageType === "success" ? "notice-success" : "notice-error"}>{message}</div>
      ) : null}

      {txHash ? <p className="muted">Transaction: {shortHash(txHash)}</p> : null}
    </section>
  );
}
