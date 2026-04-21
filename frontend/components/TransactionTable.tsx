"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchActivityFeed, type ActivityItem } from "@/lib/history";
import { formatDateTime, formatEth, shortAddress, shortHash } from "@/lib/format";
import { useWallet } from "./WalletProvider";

export default function TransactionTable() {
  const { address } = useWallet();

  const [showOnlyWallet, setShowOnlyWallet] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ActivityItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const walletFilter = showOnlyWallet ? address ?? undefined : undefined;

      if (showOnlyWallet && !walletFilter) {
        setEntries([]);
        setError("Connect wallet to filter personal activity.");
        setLastUpdated(null);
        return;
      }

      const rows = await fetchActivityFeed(walletFilter);
      setEntries(rows);
      setLastUpdated(new Date().toISOString());
    } catch (runtimeError) {
      setError(runtimeError instanceof Error ? runtimeError.message : String(runtimeError));
    } finally {
      setLoading(false);
    }
  }, [address, showOnlyWallet]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadEntries();
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefresh, loadEntries]);

  return (
    <section className="panel stack-md">
      <div className="row-between">
        <div>
          <h3 className="panel-title">On-Chain Activity Timeline</h3>
          <p className="muted">
            Includes incoming royalty split payments, outgoing simulation transactions, bids, refunds, and NFT rights transfers.
          </p>
        </div>

        <div className="actions-row">
          <button className="btn-ghost" onClick={() => setShowOnlyWallet((value) => !value)}>
            {showOnlyWallet ? "Show All Events" : "Show My Wallet Only"}
          </button>
          <button className="btn-ghost" onClick={() => setAutoRefresh((value) => !value)}>
            Auto Refresh: {autoRefresh ? "On" : "Off"}
          </button>
          <button className="btn-secondary" onClick={loadEntries}>
            Refresh
          </button>
        </div>
      </div>

      {lastUpdated ? <p className="muted tiny">Last updated: {formatDateTime(lastUpdated)}</p> : null}

      {loading ? <p className="muted">Loading activity...</p> : null}
      {error ? <div className="notice-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="table-wrap">
          <table className="event-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Token</th>
                <th>Amount</th>
                <th>Participants</th>
                <th>Tx Hash</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.occurredAt)}</td>
                  <td>
                    <div className="stack-xs">
                      <span>{entry.eventName}</span>
                      <span className="muted tiny">{entry.description}</span>
                    </div>
                  </td>
                  <td>{entry.tokenId !== undefined ? entry.tokenId.toString() : "-"}</td>
                  <td>
                    {entry.amountWei !== undefined ? `${formatEth(entry.amountWei)} ETH` : "-"}
                    <span className={`direction-badge direction-${entry.direction}`}>{entry.direction}</span>
                  </td>
                  <td>
                    <div className="stack-xs tiny">
                      <span>Actor: {shortAddress(entry.actor)}</span>
                      <span>Other: {shortAddress(entry.counterparty)}</span>
                    </div>
                  </td>
                  <td>{shortHash(entry.txHash)}</td>
                </tr>
              ))}

              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No events found yet. Run a stream simulation or an auction transaction to populate history.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
