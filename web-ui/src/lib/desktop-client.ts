// Thin server-side client for the desktop app's local Express API (desktop-client/local-api.ts).
// Centralizing these calls here is what makes the Next.js /api/download and /api/status route
// handlers actual proxies instead of the timer-based fakes they used to be - and lets the
// reviews-aggregation flow seed its aggregated blob the same way an app binary gets seeded.

const DESKTOP_API_URL = process.env.NEXT_PUBLIC_DESKTOP_API_URL || "http://localhost:3001";

export interface DesktopDownloadResponse {
  status: string;
  appId: string;
  torrentId: string;
  savePath: string;
}

export interface DesktopStatusResponse {
  status: "idle" | "in_progress" | "finished";
  progress: number;
  speed?: number;
  eta?: number;
  downloaded?: number;
  total?: number;
  verified: boolean | null;
}

export async function startDesktopDownload(
  appId: string,
  magnetLink: string,
  expectedHash: string
): Promise<DesktopDownloadResponse> {
  const res = await fetch(`${DESKTOP_API_URL}/api/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, magnetLink, expectedHash }),
  });
  if (!res.ok) {
    throw new Error(`Desktop client /api/download failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getDesktopDownloadStatus(appId: string): Promise<DesktopStatusResponse> {
  const res = await fetch(`${DESKTOP_API_URL}/api/status?appId=${encodeURIComponent(appId)}`);
  if (!res.ok) {
    throw new Error(`Desktop client /api/status failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Seeds arbitrary content (e.g. the aggregated reviews JSON blob) via the desktop client. */
export async function seedContentOnDesktopClient(
  filename: string,
  content: string
): Promise<{ magnetLink: string; fileHash: string }> {
  const form = new FormData();
  form.append("file", new Blob([content], { type: "application/json" }), filename);

  const res = await fetch(`${DESKTOP_API_URL}/api/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Desktop client /api/upload failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
