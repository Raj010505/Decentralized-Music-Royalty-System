"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeError } from "@/lib/blockchain";
import { getReadContracts } from "@/lib/contracts";
import { formatDateTime, formatEth, shortAddress } from "@/lib/format";
import { useWallet } from "@/components/WalletProvider";

interface RightsRow {
  tokenId: bigint;
  title: string;
  owner: string;
  rightsHolder: string;
  ratePerPlayWei: bigint;
  totalPlays: bigint;
  totalRoyaltyPaidWei: bigint;
  splitSummary: string;
}

export default function MyRightsPage() {
  const { address, connectWallet } = useWallet();

  const [scanUntilToken, setScanUntilToken] = useState("30");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<RightsRow[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const performScan = useCallback(
    async (options?: { connectIfMissing?: boolean; silent?: boolean }) => {
      const connectIfMissing = options?.connectIfMissing ?? false;
      const silent = options?.silent ?? false;

      if (!address) {
        if (connectIfMissing) {
          await connectWallet();
        }
        return;
      }

      const maxTokenId = Number.parseInt(scanUntilToken, 10);
      if (!Number.isFinite(maxTokenId) || maxTokenId <= 0) {
        if (!silent) {
          setMessage("Scan range must be a positive number.");
        }
        return;
      }

      if (!silent) {
        setLoading(true);
        setMessage(null);
      }

      try {
        const { musicRightsNft, royaltyManager } = getReadContracts();
        const wallet = address.toLowerCase();
        const nextRows: RightsRow[] = [];

        for (let token = 1; token <= maxTokenId; token++) {
          const tokenId = BigInt(token);

          try {
            const [owner, rightsHolder] = await Promise.all([
              musicRightsNft.ownerOf(tokenId),
              royaltyManager.rightsHolderOf(tokenId),
            ]);

            if (String(owner).toLowerCase() !== wallet && String(rightsHolder).toLowerCase() !== wallet) {
              continue;
            }

            const info = await royaltyManager.getTrackInfo(tokenId);
            const splitData = await royaltyManager.getTrackSplits(tokenId);
            const splitAccounts = splitData.accounts as string[];
            const splitBps = splitData.bps as Array<number | bigint>;

            const splitSummary = splitAccounts
              .map((entry, index) => {
                const bpsValue = Number(splitBps[index] ?? 0);
                return `${bpsValue / 100}% ${shortAddress(entry)}`;
              })
              .join(" | ");

            nextRows.push({
              tokenId,
              title: info.title as string,
              owner: String(owner),
              rightsHolder: String(rightsHolder),
              ratePerPlayWei: info.ratePerPlayWei as bigint,
              totalPlays: info.totalPlays as bigint,
              totalRoyaltyPaidWei: info.totalRoyaltyPaidWei as bigint,
              splitSummary,
            });
          } catch {
            continue;
          }
        }

        setRows(nextRows);
        setLastUpdated(new Date().toISOString());

        if (!silent) {
          if (nextRows.length === 0) {
            setMessage("No matching rights were found in the scanned token range.");
          } else {
            setMessage(null);
          }
        }
      } catch (runtimeError) {
        if (!silent) {
          setMessage(normalizeError(runtimeError));
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [address, connectWallet, scanUntilToken]
  );

  async function scanRights() {
    await performScan({ connectIfMissing: true, silent: false });
  }

  useEffect(() => {
    if (!autoRefresh || !address) {
      return;
    }

    const interval = window.setInterval(() => {
      void performScan({ connectIfMissing: false, silent: true });
    }, 12000);

    return () => {
      window.clearInterval(interval);
    };
  }, [address, autoRefresh, performScan]);

  return (
    <section className="stack-lg">
      <div className="hero-banner fade-in">
        <p className="eyebrow">Feature</p>
        <h2 className="hero-title">My Rights Portfolio</h2>
        <p className="muted">
          Find tokens where your wallet is the NFT owner or current rights holder for royalty distributions.
        </p>
      </div>

      <div className="panel stack-md">
        <div className="split-grid">
          <label className="field">
            <span>Scan token IDs up to</span>
            <input
              className="input"
              value={scanUntilToken}
              onChange={(event) => setScanUntilToken(event.target.value)}
            />
          </label>

          <div className="field">
            <span>Wallet</span>
            <div className="input">{address || "Connect wallet to scan"}</div>
          </div>
        </div>

        <button className="btn-primary" onClick={scanRights} disabled={loading}>
          {loading ? "Scanning..." : "Scan My Rights"}
        </button>

        <div className="actions-row">
          <button className="btn-ghost" onClick={() => setAutoRefresh((value) => !value)}>
            Auto Refresh: {autoRefresh ? "On" : "Off"}
          </button>
          {lastUpdated ? <span className="muted tiny">Last updated: {formatDateTime(lastUpdated)}</span> : null}
        </div>

        {message ? <div className="notice-error">{message}</div> : null}
      </div>

      <div className="panel stack-md">
        <h3 className="panel-title">Owned or Beneficiary Tracks</h3>

        <div className="table-wrap">
          <table className="event-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Title</th>
                <th>Owner</th>
                <th>Rights Holder</th>
                <th>Rate</th>
                <th>Total Plays</th>
                <th>Total Paid</th>
                <th>Splits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.tokenId.toString()}>
                  <td>{row.tokenId.toString()}</td>
                  <td>{row.title}</td>
                  <td>{shortAddress(row.owner)}</td>
                  <td>{shortAddress(row.rightsHolder)}</td>
                  <td>{formatEth(row.ratePerPlayWei)} ETH</td>
                  <td>{row.totalPlays.toString()}</td>
                  <td>{formatEth(row.totalRoyaltyPaidWei)} ETH</td>
                  <td>{row.splitSummary}</td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No rows yet. Run a scan after registering tracks.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
