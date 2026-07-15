"use client";

// This component will display the details of a selected app, including its name, description, version, rating, and a download button.
// It will also include a comments section where the developer can leave feedback and ratings for the app.

import { useState } from "react";
import DownloadButton from "./DownloadButton";
import { AppData } from "./AppList";
import CommentsSection, { AppComment } from "./CommentsSection";
import { getEthereumContractWithSigner } from "../lib/blockchain";

interface DeveloperAppDetailsProps {
  app: AppData;
  onBack: () => void;
  onVersionPublished: () => void;
  comments: AppComment[];
  onReviewSubmitted: () => void;
  reviewerAddress: string | null;
}

const DESKTOP_API_URL = process.env.NEXT_PUBLIC_DESKTOP_API_URL || "http://localhost:3001";

export default function DeveloperAppDetails({ app, onBack, onVersionPublished, comments, onReviewSubmitted, reviewerAddress }: DeveloperAppDetailsProps) {
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handlePublishVersion = async () => {
    if (!newVersionFile) {
      alert("Select the updated binary to publish.");
      return;
    }

    setIsPublishing(true);
    try {
      setStatusMessage("Hashing and seeding file via desktop client...");
      const formData = new FormData();
      formData.append("file", newVersionFile);

      const uploadRes = await fetch(`${DESKTOP_API_URL}/api/upload`, { method: "POST", body: formData });
      if (!uploadRes.ok) {
        throw new Error(`Desktop client upload failed: ${await uploadRes.text()}`);
      }
      const { magnetLink, fileHash } = await uploadRes.json();

      setStatusMessage("Sending transaction to the blockchain...");
      const contract = await getEthereumContractWithSigner();
      const tx = await contract.publishNewVersion(app.id, magnetLink, "0x" + fileHash);
      await tx.wait();

      setShowUpdateForm(false);
      setNewVersionFile(null);
      onVersionPublished();
    } catch (error: any) {
      console.error("Failed to publish new version:", error);
      alert("Failed to publish new version: " + (error.reason || error.message));
    } finally {
      setIsPublishing(false);
      setStatusMessage("");
    }
  };

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontWeight: "bold", marginBottom: "24px" }}>
        ← Back to Developer Studio
      </button>

      <div style={{ backgroundColor: "#1e293b", padding: "32px", borderRadius: "16px", border: "1px solid #334155" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ backgroundColor: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", fontSize: "12px", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" }}>Your App</span>
            <h2 style={{ color: "#f8fafc", margin: "16px 0 8px 0" }}>{app.name}</h2>
            <div style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "24px" }}>Current Version: {app.version}</div>
          </div>
        </div>

        <p style={{ color: "#cbd5e1", marginBottom: "24px" }}>{app.description}</p>

        <div style={{ backgroundColor: "#0f172a", padding: "16px", borderRadius: "8px", border: "1px dashed #3b82f6", marginBottom: "24px" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "#3b82f6" }}>Developer Actions</h4>
          <div style={{ display: "flex", gap: "16px", flexDirection: "column" }}>
            <DownloadButton appId={app.id} />
            {!showUpdateForm ? (
              <button onClick={() => setShowUpdateForm(true)} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #f59e0b", backgroundColor: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", fontWeight: "bold", cursor: "pointer" }}>Upload New Version</button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  type="file"
                  disabled={isPublishing}
                  onChange={(e) => setNewVersionFile(e.target.files?.[0] ?? null)}
                  style={{ color: "#cbd5e1" }}
                />
                {statusMessage && <p style={{ color: "#3b82f6", fontSize: "13px", margin: 0 }}>{statusMessage}</p>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={handlePublishVersion} disabled={isPublishing} style={{ padding: "0 20px", height: "40px", borderRadius: "8px", border: "none", backgroundColor: "#f59e0b", color: "white", fontWeight: "bold", cursor: isPublishing ? "not-allowed" : "pointer" }}>
                    {isPublishing ? "Publishing..." : "Save"}
                  </button>
                  <button onClick={() => setShowUpdateForm(false)} disabled={isPublishing} style={{ padding: "0 20px", height: "40px", borderRadius: "8px", border: "1px solid #64748b", backgroundColor: "transparent", color: "#cbd5e1", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <CommentsSection
          appId={app.id}
          comments={comments}
          onReviewSubmitted={onReviewSubmitted}
          isDeveloperMode={true}
          reviewerAddress={reviewerAddress}
        />
      </div>
    </div>
  );
}
