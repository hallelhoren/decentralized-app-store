"use client";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "in_progress" | "finished";

export default function DownloadButton({ appId }: { appId: string }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Without this, navigating away mid-download (e.g. clicking "Back to Store") never clears
  // the interval - it keeps polling /api/status once a second forever, since nothing else
  // ever stops it once the component that created it is gone.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startDownload = async () => {
    if (!appId) {
      console.error("DownloadButton: appId is missing!");
      return;
    }

    setStatus("in_progress");
    setError(null);

    const startRes = await fetch("/api/download", {
      method: "POST",
      body: JSON.stringify({ appId }),
      headers: { "Content-Type": "application/json" },
    });

    if (!startRes.ok) {
      const body = await startRes.json().catch(() => null);
      setError(body?.error || "Failed to start download");
      setStatus("idle");
      return;
    }

    intervalRef.current = setInterval(async () => {
      const res = await fetch(`/api/status?appId=${encodeURIComponent(appId)}`);
      const data = await res.json();

      setProgress(data.progress ?? 0);

      if (data.status === "finished" || data.progress >= 100) {
        setStatus("finished");
        setVerified(data.verified ?? null);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 1000);
  };

  return (
    <div style={{ width: "256px" }}>
      {status === "idle" && (
        <button
          onClick={startDownload}
          style={{ width: "100%", padding: "12px 24px", borderRadius: "8px", border: "none", backgroundColor: "#4f46e5", color: "white", fontWeight: "600", cursor: "pointer" }}
        >
          Download App
        </button>
      )}

      {status === "in_progress" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#cbd5e1", marginBottom: "6px" }}>
            <span>Downloading via BitTorrent...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{ width: "100%", backgroundColor: "#334155", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, backgroundColor: "#4f46e5", height: "100%", transition: "width 0.5s ease-out" }} />
          </div>
        </div>
      )}

      {status === "finished" && verified === true && (
        <div style={{ width: "100%", backgroundColor: "rgba(16,185,129,0.15)", color: "#10b981", textAlign: "center", fontWeight: "bold", padding: "12px", borderRadius: "8px", border: "1px solid rgba(16,185,129,0.4)" }}>
          ✓ Downloaded &amp; verified (SHA-256 matches on-chain hash)
        </div>
      )}

      {status === "finished" && verified === false && (
        <div style={{ width: "100%", backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444", textAlign: "center", fontWeight: "bold", padding: "12px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.4)" }}>
          ✗ Hash mismatch - file rejected, do not install
        </div>
      )}

      {status === "finished" && verified === null && (
        <div style={{ width: "100%", backgroundColor: "rgba(148,163,184,0.15)", color: "#cbd5e1", textAlign: "center", fontWeight: "bold", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
          ✓ Downloaded (integrity not checked)
        </div>
      )}

      {error && <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "8px" }}>{error}</p>}
    </div>
  );
}
