"use client";

import { isAddress, parseEther } from "ethers";
import { FormEvent, useMemo, useState } from "react";
import { CONTRACT_ADDRESSES } from "@/lib/addresses";
import { normalizeError } from "@/lib/blockchain";
import { getWriteContracts } from "@/lib/contracts";
import { shortHash } from "@/lib/format";
import { useWallet } from "./WalletProvider";

interface SplitInput {
  role: string;
  account: string;
  bps: string;
}

export default function RegisterTrackForm() {
  const { address, isCorrectNetwork, connectWallet, switchNetwork } = useWallet();

  const [title, setTitle] = useState("Demo Song #2");
  const [metadataURI, setMetadataURI] = useState("ipfs://demo-song-2");
  const [ratePerPlayEth, setRatePerPlayEth] = useState("0.00001");
  const [rightsHolderSplitIndex, setRightsHolderSplitIndex] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [createdTokenId, setCreatedTokenId] = useState<string | null>(null);

  const [splits, setSplits] = useState<SplitInput[]>([
    { role: "Original Owner", account: "", bps: "5000" },
    { role: "Singer", account: "", bps: "3000" },
    { role: "Producer", account: "", bps: "2000" },
  ]);

  const totalBps = useMemo(
    () => splits.reduce((sum, split) => sum + Number.parseInt(split.bps || "0", 10), 0),
    [splits]
  );

  function updateSplit(index: number, key: keyof SplitInput, value: string) {
    setSplits((previous) => {
      const next = [...previous];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!address) {
      await connectWallet();
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    const splitAccounts = splits.map((entry, index) => {
      const value = entry.account.trim();

      if (index === 0 && !value && address) {
        return address;
      }

      return value;
    });
    const splitBps = splits.map((entry) => Number.parseInt(entry.bps, 10));
    const rightsHolderIndex = Number.parseInt(rightsHolderSplitIndex, 10);

    if (!title.trim()) {
      setFeedbackType("error");
      setFeedback("Track title is required.");
      return;
    }

    if (!metadataURI.trim()) {
      setFeedbackType("error");
      setFeedback("Metadata URI is required.");
      return;
    }

    if (splitAccounts.some((entry) => !isAddress(entry))) {
      setFeedbackType("error");
      setFeedback("Each split account must be a valid wallet address.");
      return;
    }

    if (splitBps.some((entry) => !Number.isFinite(entry) || entry <= 0)) {
      setFeedbackType("error");
      setFeedback("Each split percentage must be a positive integer in basis points.");
      return;
    }

    if (totalBps !== 10_000) {
      setFeedbackType("error");
      setFeedback("Royalty split total must equal exactly 10,000 bps (100%).");
      return;
    }

    if (rightsHolderIndex < 0 || rightsHolderIndex >= splits.length) {
      setFeedbackType("error");
      setFeedback("Rights holder split index is out of range.");
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    setTxHash(null);
    setCreatedTokenId(null);

    try {
      const { royaltyManager } = await getWriteContracts();
      const tx = await royaltyManager.registerTrack(
        title.trim(),
        metadataURI.trim(),
        splitAccounts,
        splitBps,
        rightsHolderIndex,
        parseEther(ratePerPlayEth)
      );

      setTxHash(tx.hash);
      const receipt = await tx.wait();

      const managerAddress = CONTRACT_ADDRESSES.RoyaltyManager.toLowerCase();
      for (const log of receipt.logs) {
        const parsedLog = log as unknown as {
          address: string;
          topics: readonly string[];
          data: string;
        };

        if (parsedLog.address.toLowerCase() !== managerAddress) {
          continue;
        }

        const parsed = royaltyManager.interface.parseLog({
          topics: parsedLog.topics,
          data: parsedLog.data,
        });

        if (parsed && parsed.name === "TrackRegistered") {
          setCreatedTokenId(parsed.args.tokenId.toString());
          break;
        }
      }

      setFeedbackType("success");
      setFeedback("Track registered successfully. You can now simulate plays or create an auction.");
    } catch (runtimeError) {
      setFeedbackType("error");
      setFeedback(normalizeError(runtimeError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel stack-lg" onSubmit={onSubmit}>
      <div className="stack-sm">
        <h3 className="panel-title">Music Registration</h3>
        <p className="muted">
          Register a new track NFT with royalty split recipients. Contract: {CONTRACT_ADDRESSES.RoyaltyManager}
        </p>
      </div>

      <label className="field">
        <span>Track title</span>
        <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label className="field">
        <span>Metadata URI</span>
        <input
          className="input"
          value={metadataURI}
          onChange={(event) => setMetadataURI(event.target.value)}
          placeholder="ipfs://your-track-metadata"
        />
      </label>

      <label className="field">
        <span>Rate per play (ETH)</span>
        <input
          className="input"
          type="number"
          min="0"
          step="0.00000001"
          value={ratePerPlayEth}
          onChange={(event) => setRatePerPlayEth(event.target.value)}
        />
      </label>

      <div className="stack-sm">
        <div className="row-between">
          <h4>Royalty splits (basis points)</h4>
          <span className={totalBps === 10_000 ? "pill-success" : "pill-warning"}>
            Total: {totalBps} / 10000
          </span>
        </div>

        {splits.map((split, index) => (
          <div className="split-grid" key={split.role}>
            <label className="field">
              <span>{split.role} address</span>
              <input
                className="input"
                value={split.account}
                placeholder={index === 0 && address ? address : "0x..."}
                onChange={(event) => updateSplit(index, "account", event.target.value)}
              />
            </label>

            <label className="field">
              <span>{split.role} bps</span>
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={split.bps}
                onChange={(event) => updateSplit(index, "bps", event.target.value)}
              />
            </label>
          </div>
        ))}
      </div>

      <label className="field">
        <span>Rights holder split index</span>
        <select
          className="input"
          value={rightsHolderSplitIndex}
          onChange={(event) => setRightsHolderSplitIndex(event.target.value)}
        >
          {splits.map((split, index) => (
            <option key={split.role} value={index.toString()}>
              {index} - {split.role}
            </option>
          ))}
        </select>
      </label>

      <button className="btn-primary" disabled={submitting}>
        {submitting ? "Registering..." : "Register Track"}
      </button>

      {feedback ? (
        <div className={feedbackType === "success" ? "notice-success" : "notice-error"}>{feedback}</div>
      ) : null}

      {txHash ? (
        <p className="muted">
          Transaction: {shortHash(txHash)}
          {createdTokenId ? ` | Token ID: ${createdTokenId}` : ""}
        </p>
      ) : null}
    </form>
  );
}
