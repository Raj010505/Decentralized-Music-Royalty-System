"use client";

import { FormEvent, useMemo, useState } from "react";
import { normalizeError } from "@/lib/blockchain";
import { getReadContracts, getWriteContracts } from "@/lib/contracts";
import { formatEth, shortAddress, shortHash } from "@/lib/format";
import { useWallet } from "./WalletProvider";

interface QuoteResult {
  tokenId: bigint;
  plays: bigint;
  totalCost: bigint;
  recipients: string[];
  amounts: bigint[];
  title: string;
}

export default function StreamSimulator() {
  const { address, isCorrectNetwork, connectWallet, switchNetwork } = useWallet();

  const [tokenIdInput, setTokenIdInput] = useState("1");
  const [playsInput, setPlaysInput] = useState("1000");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [quote, setQuote] = useState<QuoteResult | null>(null);

  const quoteRows = useMemo(() => {
    if (!quote) {
      return [];
    }

    return quote.recipients.map((recipient, index) => ({
      recipient,
      amount: quote.amounts[index],
    }));
  }, [quote]);

  async function buildQuote() {
    const tokenId = BigInt(tokenIdInput);
    const plays = BigInt(playsInput);

    const { royaltyManager } = getReadContracts();

    const quoteResult = await royaltyManager.quoteRoyaltyDistribution(tokenId, plays);
    const trackInfo = await royaltyManager.getTrackInfo(tokenId);

    const nextQuote: QuoteResult = {
      tokenId,
      plays,
      totalCost: quoteResult.totalCost as bigint,
      recipients: [...(quoteResult.recipients as string[])],
      amounts: [...(quoteResult.amounts as bigint[])],
      title: trackInfo.title as string,
    };

    setQuote(nextQuote);
    return nextQuote;
  }

  async function onQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      await buildQuote();
      setMessageType("success");
      setMessage("Quote refreshed. You can now execute the simulation payment.");
    } catch (runtimeError) {
      setMessageType("error");
      setMessage(normalizeError(runtimeError));
    }
  }

  async function simulatePlays() {
    if (!address) {
      await connectWallet();
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    setBusy(true);
    setMessage(null);
    setTxHash(null);

    try {
      const activeQuote = quote ?? (await buildQuote());
      const { royaltyManager } = await getWriteContracts();

      const tx = await royaltyManager.simulatePlays(activeQuote.tokenId, activeQuote.plays, {
        value: activeQuote.totalCost,
      });

      setTxHash(tx.hash);
      await tx.wait();

      setMessageType("success");
      setMessage("Streaming simulation completed and royalties were distributed automatically.");
    } catch (runtimeError) {
      setMessageType("error");
      setMessage(normalizeError(runtimeError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack-lg">
      <div className="stack-sm">
        <h3 className="panel-title">Streaming Simulator</h3>
        <p className="muted">Enter token ID and play count to calculate and pay royalty splits in one transaction.</p>
      </div>

      <form className="stack-md" onSubmit={onQuote}>
        <div className="split-grid">
          <label className="field">
            <span>Token ID</span>
            <input className="input" value={tokenIdInput} onChange={(event) => setTokenIdInput(event.target.value)} />
          </label>

          <label className="field">
            <span>Simulated plays</span>
            <input className="input" value={playsInput} onChange={(event) => setPlaysInput(event.target.value)} />
          </label>
        </div>

        <div className="actions-row">
          <button className="btn-secondary" type="submit">
            Quote Payouts
          </button>

          <button className="btn-primary" type="button" onClick={simulatePlays} disabled={busy}>
            {busy ? "Processing..." : "Run Simulation"}
          </button>
        </div>
      </form>

      {quote ? (
        <div className="stack-md">
          <div className="row-between">
            <p>
              <strong>{quote.title}</strong> | Token #{quote.tokenId.toString()} | Plays: {quote.plays.toString()}
            </p>
            <p className="pill-success">Total cost: {formatEth(quote.totalCost)} ETH</p>
          </div>

          <div className="table-wrap">
            <table className="event-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {quoteRows.map((row) => (
                  <tr key={`${row.recipient}-${row.amount.toString()}`}>
                    <td>{shortAddress(row.recipient)}</td>
                    <td>{formatEth(row.amount)} ETH</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className={messageType === "success" ? "notice-success" : "notice-error"}>{message}</div>
      ) : null}

      {txHash ? <p className="muted">Transaction: {shortHash(txHash)}</p> : null}

      <p className="muted tiny">Tip: seeded demo data includes Token ID 1. Use 1000 plays to mirror your requirement.</p>
    </section>
  );
}
