"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Progress, Stack, Text } from "@mantine/core";

type Status = "idle" | "in_progress" | "finished";

// Hands the finished file to the browser as a real download (native save prompt), driven
// off the desktop client's Content-Disposition header via the /api/download/file proxy.
function triggerBrowserDownload(appId: string) {
  const link = document.createElement("a");
  link.href = `/api/download/file?appId=${encodeURIComponent(appId)}`;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function DownloadButton({ appId }: { appId: string }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards against triggering the browser download twice: setInterval keeps firing every
  // 1000ms regardless of whether the previous tick's fetch has resolved yet, so if a tick
  // takes long enough, two ticks can both observe "finished" before either gets a chance to
  // clear the timer. This flag is checked+set synchronously, before either tick can start
  // its own async work, so only the first one ever proceeds.
  const completedRef = useRef(false);

  // Without this, navigating away mid-download (e.g. back to /store) never clears the
  // interval - it keeps polling /api/status once a second forever, since nothing else
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
    completedRef.current = false;

    let startRes: Response;
    try {
      startRes = await fetch("/api/download", {
        method: "POST",
        body: JSON.stringify({ appId }),
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      setError("Could not reach the download service");
      setStatus("idle");
      return;
    }

    if (!startRes.ok) {
      const body = await startRes.json().catch(() => null);
      setError(body?.error || "Failed to start download");
      setStatus("idle");
      return;
    }

    intervalRef.current = setInterval(async () => {
      if (completedRef.current) return;

      try {
        const res = await fetch(`/api/status?appId=${encodeURIComponent(appId)}`);
        const data = await res.json();

        if (completedRef.current) return; // a concurrent tick already handled completion

        if (data.status === "error") {
          completedRef.current = true;
          if (intervalRef.current) clearInterval(intervalRef.current);
          setError(data.error || "Download failed");
          setStatus("idle");
          setProgress(0);
          return;
        }

        setProgress(data.progress ?? 0);

        if (data.status === "finished" || data.progress >= 100) {
          completedRef.current = true;
          if (intervalRef.current) clearInterval(intervalRef.current);
          setStatus("finished");
          setVerified(data.verified ?? null);
          // Don't hand the user a file that failed on-chain hash verification.
          if (data.verified !== false) {
            triggerBrowserDownload(appId);
          }
        }
      } catch (err) {
        // Transient network hiccup while polling - keep the interval running and retry
        // on the next tick rather than giving up on the whole download.
        console.error("Status poll failed:", err);
      }
    }, 1000);
  };

  return (
    <Stack gap="xs" style={{ width: 260 }}>
      {status === "idle" && (
        <Button onClick={startDownload} fullWidth>
          Download App
        </Button>
      )}

      {status === "in_progress" && (
        <Stack gap={4}>
          <Text size="xs" c="dimmed">
            Downloading via BitTorrent... {Math.round(progress)}%
          </Text>
          <Progress value={progress} animated />
        </Stack>
      )}

      {status === "finished" && verified === true && (
        <Alert color="green" title="Downloaded & verified">
          SHA-256 matches the on-chain hash.
        </Alert>
      )}

      {status === "finished" && verified === false && (
        <Alert color="red" title="Hash mismatch">
          File rejected - do not install.
        </Alert>
      )}

      {status === "finished" && verified === null && (
        <Alert color="gray" title="Downloaded">
          Integrity not checked.
        </Alert>
      )}

      {error && (
        <Text c="red" size="xs">
          {error}
        </Text>
      )}
    </Stack>
  );
}
