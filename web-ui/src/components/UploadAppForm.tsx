"use client";

import { useState } from "react";
import { getEthereumContractWithSigner } from "../lib/blockchain";

interface UploadAppFormProps {
  onCancel: () => void;
  onSubmit: () => void;
}

const DESKTOP_API_URL = process.env.NEXT_PUBLIC_DESKTOP_API_URL || "http://localhost:3001";

export default function UploadAppForm({ onCancel, onSubmit }: UploadAppFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("Please select the application binary to publish.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Hand the real file to the desktop client: it hashes it (SHA-256) and starts
      // seeding it over BitTorrent, returning the magnet link + hash to anchor on-chain.
      // Browsers can't hand over an absolute filesystem path, so the binary itself is what
      // gets sent here - not a path string like the earlier mocked version assumed.
      setStatusMessage("Hashing and seeding file via desktop client...");
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(`${DESKTOP_API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        throw new Error(`Desktop client upload failed: ${await uploadRes.text()}`);
      }
      const { magnetLink, fileHash } = await uploadRes.json();

      // 2. Initialize the smart contract instance connected to MetaMask (this also forces
      // MetaMask onto the local Hardhat network before signing anything).
      setStatusMessage("Waiting for wallet...");
      const contract = await getEthereumContractWithSigner();

      const tagsArray = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const shaDigestBytes32 = "0x" + fileHash;

      setStatusMessage("Sending transaction to the blockchain...");
      const tx = await contract.publishApp(name, description, tagsArray, magnetLink, shaDigestBytes32);
      await tx.wait();

      onSubmit();
    } catch (error: any) {
      console.error("Publish failed:", error);
      alert("Failed to publish app: " + (error.reason || error.message));
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto", backgroundColor: "#1e293b", padding: "32px", borderRadius: "16px", border: "1px solid #334155" }}>
      <h2 style={{ marginTop: 0, color: "#f8fafc" }}>Upload New dApp</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <input
          placeholder="App Name" value={name} onChange={(e) => setName(e.target.value)} required
          disabled={isLoading}
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }}
        />
        <textarea
          placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={4}
          disabled={isLoading}
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }}
        />
        <input
          placeholder="Tags (comma separated, e.g. tools, utility, game)"
          value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
          disabled={isLoading}
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }}
        />
        <label style={{ color: "#94a3b8", fontSize: "14px" }}>
          Application binary
          <input
            type="file"
            required
            disabled={isLoading}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ display: "block", marginTop: "8px", color: "#cbd5e1" }}
          />
        </label>

        {statusMessage && <p style={{ color: "#3b82f6", fontSize: "14px", margin: 0 }}>{statusMessage}</p>}

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
