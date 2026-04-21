"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TARGET_CHAIN_ID } from "@/lib/addresses";
import {
  getBrowserProvider,
  getInjectedProvider,
  normalizeError,
  switchToHardhatNetwork,
} from "@/lib/blockchain";

interface WalletContextValue {
  address: string | null;
  chainId: number | null;
  hasWallet: boolean;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWallet = useCallback(async () => {
    const injected = getInjectedProvider();

    if (!injected) {
      setHasWallet(false);
      setAddress(null);
      setChainId(null);
      return;
    }

    setHasWallet(true);

    try {
      const provider = getBrowserProvider();
      const [accounts, network] = await Promise.all([
        provider.send("eth_accounts", []),
        provider.getNetwork(),
      ]);

      const firstAccount = Array.isArray(accounts)
        ? (accounts[0] as string | undefined)
        : undefined;

      setAddress(firstAccount ?? null);
      setChainId(Number(network.chainId));
    } catch (runtimeError) {
      setError(normalizeError(runtimeError));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshWallet();

    const injected = getInjectedProvider();
    if (!injected?.on || !injected.removeListener) {
      return;
    }

    const handleAccountsChanged = (accounts: unknown) => {
      if (Array.isArray(accounts) && typeof accounts[0] === "string") {
        setAddress(accounts[0]);
      } else {
        setAddress(null);
      }
    };

    const handleChainChanged = (value: unknown) => {
      if (typeof value === "string") {
        setChainId(Number.parseInt(value, 16));
      }
    };

    injected.on("accountsChanged", handleAccountsChanged);
    injected.on("chainChanged", handleChainChanged);

    return () => {
      injected.removeListener?.("accountsChanged", handleAccountsChanged);
      injected.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refreshWallet]);

  const connectWallet = useCallback(async () => {
    const injected = getInjectedProvider();
    if (!injected) {
      setError("MetaMask extension was not found in this browser.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await injected.request({ method: "eth_requestAccounts" });
      await switchToHardhatNetwork();
      await refreshWallet();
    } catch (runtimeError) {
      setError(normalizeError(runtimeError));
    } finally {
      setIsConnecting(false);
    }
  }, [refreshWallet]);

  const switchNetwork = useCallback(async () => {
    setError(null);

    try {
      await switchToHardhatNetwork();
      await refreshWallet();
    } catch (runtimeError) {
      setError(normalizeError(runtimeError));
    }
  }, [refreshWallet]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      chainId,
      hasWallet,
      isConnecting,
      isCorrectNetwork: chainId === TARGET_CHAIN_ID,
      error,
      connectWallet,
      switchNetwork,
      refreshWallet,
      clearError,
    }),
    [
      address,
      chainId,
      hasWallet,
      isConnecting,
      error,
      connectWallet,
      switchNetwork,
      refreshWallet,
      clearError,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);

  if (!value) {
    throw new Error("useWallet must be used inside WalletProvider");
  }

  return value;
}
