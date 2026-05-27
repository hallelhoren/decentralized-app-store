"use client";

// This component will handle the download button functionality for each app.
// When the user clicks the download button, it will simulate a download process with a progress bar and display a success message once completed.

import { useState, useEffect } from "react";

export default function DownloadButton() {
  const [status, setStatus] = useState<"idle" | "downloading" | "completed">("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "downloading") {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setStatus("completed");
            return 100;
          }
          return prev + 10;
        });
      }, 120); // קצב התקדמות הבר
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleDownload = () => {
    setStatus("downloading");
    setProgress(0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px", width: "100%" }}>
      {status === "idle" && (
        <button
          onClick={handleDownload}
          style={{
            backgroundColor: "#3b82f6",
            color: "#ffffff",
            border: "none",
            padding: "12px 20px",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "15px",
          }}
        >
          Download dApp
        </button>
      )}

      {status === "downloading" && (
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: "14px", marginBottom: "6px" }}>
            <span>Downloading...</span>
            <span>{progress}%</span>
          </div>
          <div style={{ width: "100%", backgroundColor: "#334155", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                backgroundColor: "#3b82f6",
                height: "100%",
                transition: "width 0.1s linear",
              }}
            />
          </div>
        </div>
      )}

      {status === "completed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              border: "1px solid #10b981",
              color: "#10b981",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            ✓ ההורדה התבצעה בהצלחה!
          </div>
          <button
            onClick={() => setStatus("idle")}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              fontSize: "12px",
              textDecoration: "underline",
            }}
          >
            Reset Download
          </button>
        </div>
      )}
    </div>
  );
}