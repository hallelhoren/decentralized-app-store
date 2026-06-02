"use client";

// This component will provide a form for developers to upload their dApps to the store.
// It will include fields for the app name, description, version, and a submit button to publish the app.
import { useState } from "react";
import { ethers } from "ethers";
import { getEthereumContractWithSigner } from "../lib/blockchain";

interface UploadAppFormProps {
  onCancel: () => void;
  onSubmit: (app: any) => void;
}

// Helper function to ensure MetaMask is on the Hardhat Local network
async function switchToLocalNetwork() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
  }

  try {
    // Request to switch to the local Hardhat network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x7a69' }], // 0x7a69 is the hex value for 31337
    });
  } catch (switchError: any) {
    // This error code indicates that the local chain has not been added to MetaMask
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x7a69',
            chainName: 'Hardhat Local',
            rpcUrls: ['http://127.0.0.1:8545'],
            nativeCurrency: {
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18,
            },
          },
        ],
      });
    } else {
      // Throw error if user rejects the network switch
      throw switchError;
    }
  }
}

export default function UploadAppForm({ onCancel, onSubmit }: UploadAppFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [torrentRef, setTorrentRef] = useState(""); // Track BitTorrent magnet/infohash
  const [tagsInput, setTagsInput] = useState("");   // Comma separated tags
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Force network switch to Hardhat local before proceeding
      await switchToLocalNetwork();

      // 2. Initialize the smart contract instance connected to MetaMask
      const contract = await getEthereumContractWithSigner();

      // 3. Process tags into a clean string array for Solidity
      const tagsArray = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      // 4. Prepare a valid 32 byte hex string for testing
      const mockShaDigest = ethers.zeroPadValue("0x123456", 32);

      console.log("Sending transaction to local blockchain...");

      // 5. Invoke the publishApp function on your deployed Solidity contract
      const tx = await contract.publishApp(
        name,
        description,
        tagsArray,
        torrentRef,
        mockShaDigest
      );

      console.log("Transaction pending... Hash:", tx.hash);

      // 6. Wait for the Hardhat node to mine the block successfully
      const receipt = await tx.wait();
      console.log("Transaction mined! Block:", receipt.blockNumber);

      // 7. Notify the parent component
      onSubmit({
        id: receipt.blockNumber.toString(),
        name,
        description,
        category: tagsArray[0] || "General",
        rating: 0,
        version: "1.0.0",
        torrentRef,
      });

      //alert("Application successfully published to the Blockchain!");
    } catch (error: any) {
      console.error("Blockchain transaction failed:", error);
      alert("Failed to publish app: " + (error.reason || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto", backgroundColor: "#1e293b", padding: "32px", borderRadius: "16px", border: "1px solid #334155" }}>
      <h2 style={{ marginTop: 0, color: "#f8fafc" }}>Upload New dApp</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        <input 
          placeholder="App Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required
          disabled={isLoading}
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }} 
        />
        
        <textarea 
          placeholder="Description" 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          required
          rows={4}
          disabled={isLoading}
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }} 
        />
        
        <input 
          placeholder="BitTorrent InfoHash / Magnet Link" 
          value={torrentRef} 
          onChange={(e) => setTorrentRef(e.target.value)} 
          required
          disabled={isLoading}
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }} 
        />

        <input 
          placeholder="Tags (comma separated, e.g. tools, utility, game)" 
          value={tagsInput} 
          onChange={(e) => setTagsInput(e.target.value)} 
          disabled={isLoading}
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }} 
        />

        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: isLoading ? "#64748b" : "#10b981", color: "white", fontWeight: "bold", cursor: isLoading ? "not-allowed" : "pointer" }}
          >
            {isLoading ? "Publishing..." : "Publish to Blockchain"}
          </button>
          <button type="button" onClick={onCancel} disabled={isLoading} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #64748b", backgroundColor: "transparent", color: "#cbd5e1", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}