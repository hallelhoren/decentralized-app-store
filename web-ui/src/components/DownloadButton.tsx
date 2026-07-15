"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Progress, Stack, Text } from "@mantine/core";

type Status = "idle" | "in_progress" | "finished";

export default function DownloadButton({ appId }: { appId: string }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
