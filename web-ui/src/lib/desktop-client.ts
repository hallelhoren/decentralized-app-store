// Thin server-side client for the desktop app's local Express API (desktop-client/local-api.ts).
// Centralizing these calls here keeps the Next.js /api/download and /api/status routes as
// plain proxies, and lets the aggregation flows seed their blobs the same way an app binary
// gets seeded.

const DESKTOP_API_URL = process.env.NEXT_PUBLIC_DESKTOP_API_URL || "http://localhost:3001";

export interface DesktopDownloadResponse {
  status: string;
  appId: string;
  torrentId: string;
  savePath: string;
}

export interface DesktopStatusResponse {
  status: "idle" | "in_progress" | "finished" | "error";
  progress: number;
  speed?: number;
  eta?: number;
  downloaded?: number;
  total?: number;
  verified: boolean | null;
  error?: string;
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

/**
 * Raw response for a completed download's file bytes - the /api/download/file route streams
 * this through as-is, so its status, headers, and body all pass through unchanged.
 */
export async function fetchDesktopDownloadFile(appId: string): Promise<Response> {
  return fetch(`${DESKTOP_API_URL}/api/download/file?appId=${encodeURIComponent(appId)}`);
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
