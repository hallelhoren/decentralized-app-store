"use client";

// This component will display the details of a selected app, including its name, description, version, rating, and a download button.
// It will also include a comments section where users can leave feedback and ratings for the app.

import { useState } from "react";
import { AppData } from "./AppList";
import DownloadButton from "./DownloadButton";
import CommentsSection, { AppComment } from "./CommentsSection";
import { getEthereumContractWithSigner } from "../lib/blockchain";

interface AppDetailsProps {
  app: AppData;
  onBack: () => void;
  comments: AppComment[];
  onReviewSubmitted: () => void;
  reviewerAddress: string | null;
}

export default function AppDetails({ app, onBack, comments, onReviewSubmitted, reviewerAddress }: AppDetailsProps) {
  const [isReporting, setIsReporting] = useState(false);

  const handleReport = async () => {
    const reason = window.prompt("Why are you reporting this app? (e.g. malware, scam, broken)");
    if (!reason) return;

    setIsReporting(true);
    try {
      const contract = await getEthereumContractWithSigner();
      const tx = await contract.reportApp(app.id, reason);
      await tx.wait();
      alert("Report submitted on-chain. Thank you.");
    } catch (error: any) {
      console.error("Failed to report app:", error);
      alert("Failed to submit report: " + (error.reason || error.message));
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "640px", margin: "0 auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "14px", fontWeight: "600", marginBottom: "24px", padding: 0 }}>
        ← Back to Store
      </button>

      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "32px" }}>
        <span style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", fontSize: "12px", padding: "4px 8px", borderRadius: "4px", fontWeight: "600" }}>{app.category}</span>
        <h2 style={{ color: "#f8fafc", fontSize: "26px", margin: "16px 0 8px 0", fontWeight: "700" }}>{app.name}</h2>
        <div style={{ display: "flex", gap: "12px", fontSize: "14px", color: "#94a3b8", marginBottom: "24px" }}>
          <span>Rating: ⭐ {app.rating} ({app.ratingCount})</span>
          <span>•</span>
          <span>Version: {app.version}</span>
          {app.reportCount > 0 && (
            <>
              <span>•</span>
              <span style={{ color: "#f59e0b" }}>⚠ {app.reportCount} report{app.reportCount === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
        <p style={{ color: "#cbd5e1", fontSize: "16px", lineHeight: "1.6", margin: "0 0 20px 0" }}>{app.description}</p>

        <div style={{ backgroundColor: "#0f172a", borderRadius: "8px", padding: "14px", fontSize: "12px", fontFamily: "monospace", color: "#64748b", border: "1px solid #1e293b", marginBottom: "20px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ color: "#94a3b8", fontWeight: "bold" }}>Publisher:</span> {app.publisher}
        </div>

        {app.versions.length > 0 && (
          <details style={{ marginBottom: "24px" }}>
            <summary style={{ color: "#94a3b8", cursor: "pointer", fontSize: "13px", marginBottom: "8px" }}>
              Version history ({app.versions.length})
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
              {app.versions.map((v) => (
                <div key={v.versionId} style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", padding: "10px 12px", fontSize: "12px" }}>
                  <div style={{ color: "#cbd5e1", fontWeight: "bold", marginBottom: "4px" }}>
                    v{v.versionId} — {new Date(v.publishedAt).toLocaleDateString()}
                  </div>
                  <div style={{ color: "#64748b", fontFamily: "monospace", wordBreak: "break-all" }}>
                    torrent: {v.torrentRef || "(none)"}
                  </div>
                  <div style={{ color: "#64748b", fontFamily: "monospace", wordBreak: "break-all" }}>
                    sha256: {v.sha256Digest}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "28px" }}>
          <DownloadButton appId={app.id} />
          <button
            onClick={handleReport}
            disabled={isReporting}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #ef4444", backgroundColor: "transparent", color: "#ef4444", cursor: isReporting ? "not-allowed" : "pointer", fontSize: "13px" }}
          >
            {isReporting ? "Reporting..." : "🚩 Report app"}
          </button>
        </div>

        <CommentsSection
          appId={app.id}
          comments={comments}
          onReviewSubmitted={onReviewSubmitted}
          isDeveloperMode={false}
          reviewerAddress={reviewerAddress}
        />
      </div>
    </div>
  );
}
