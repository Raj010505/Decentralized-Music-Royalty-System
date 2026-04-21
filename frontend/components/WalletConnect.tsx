"use client";

import { NETWORK_NAME, TARGET_CHAIN_ID } from "@/lib/addresses";
import { shortAddress } from "@/lib/format";
import { useWallet } from "./WalletProvider";

export default function WalletConnect() {
  const {
    address,
    chainId,
    hasWallet,
    isConnecting,
    isCorrectNetwork,
    error,
    connectWallet,
    switchNetwork,
    clearError,
  } = useWallet();

  return (
    <div className="wallet-card fade-in">
      {!hasWallet ? (
        <div className="stack-sm">
          <p className="tiny-title">Wallet</p>
          <p className="muted">MetaMask extension not detected in this browser.</p>
          <a className="btn-secondary" href="https://metamask.io/download" target="_blank" rel="noreferrer">
            Install MetaMask
          </a>
        </div>
      ) : (
        <div className="stack-sm">
          <p className="tiny-title">Connected Wallet</p>
          <p className="wallet-address">{address ? shortAddress(address) : "Not connected"}</p>
          <p className="muted">
            Chain: {chainId ?? "-"} | Target: {TARGET_CHAIN_ID} ({NETWORK_NAME})
          </p>

          <div className="actions-row">
            {!address ? (
              <button className="btn-primary" onClick={connectWallet} disabled={isConnecting}>
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            ) : !isCorrectNetwork ? (
              <button className="btn-primary" onClick={switchNetwork}>
                Switch to Hardhat Local
              </button>
            ) : (
              <span className="pill-success">Ready</span>
            )}
          </div>
        </div>
      )}

      {error ? (
        <div className="notice-error">
          <p>{error}</p>
          <button className="btn-ghost" onClick={clearError}>
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
