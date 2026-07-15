"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { connectWallet, getAlreadyConnectedAccount } from "./blockchain";

interface WalletState {
  walletAddress: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletState | undefined>(undefined);

// Wallet state now needs to be shared across separate routed pages (store/dev/profile)
// instead of a single useState in one tab-switching page.tsx, so it lives in a context
// at the root instead. Logic here is a straight port of what page.tsx used to do.
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    getAlreadyConnectedAccount().then((address) => {
      if (address) setWalletAddress(address);
    });
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const address = await connectWallet();
      setWalletAddress(address);
    } catch (error: any) {
      console.error("Failed to connect wallet:", error);
      alert(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // MetaMask has no reliable way for a site to force a real disconnect - wallet_revokePermissions
  // (EIP-2255) isn't supported by every wallet/version, so this is best-effort: try it, but
  // always clear our own local state regardless, which is what actually gates the UI.
  const disconnect = useCallback(async () => {
    try {
      await window.ethereum?.request?.({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Not supported by this wallet - fine, local state below is what matters to this app.
    }
    setWalletAddress(null);
  }, []);

  return (
    <WalletContext.Provider value={{ walletAddress, isConnecting, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
