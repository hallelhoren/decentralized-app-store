import type { AppData } from "../components/AppList";

export interface ApiApp {
  id: number;
  publisher: string;
  publisherName: string | null;
  name: string;
  description: string;
  tags: string[];
  icon: string | null;
  latestVersionId: number;
  averageRating: number;
  ratingCount: number;
  reportCount: number;
  downloadCount: number;
  versions: {
    versionId: number;
    torrentRef: string;
    sha256Digest: string;
    publishedAt: string;
    releaseNotes: string | null;
  }[];
}

export function toAppData(app: ApiApp): AppData {
  return {
    id: String(app.id),
    name: app.name,
    description: app.description,
    category: app.tags[0] || "General",
    tags: app.tags,
    icon: app.icon,
    rating: Number(app.averageRating.toFixed(1)),
    ratingCount: app.ratingCount,
    reportCount: app.reportCount,
    downloadCount: app.downloadCount,
    version: String(app.latestVersionId),
    publisher: app.publisher,
    publisherName: app.publisherName,
    versions: app.versions,
  };
}

/** The publisher's chosen display name if they've set one, otherwise a truncated address. */
export function formatPublisher(address: string, publisherName: string | null): string {
  return publisherName || `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Shared by /store and /dev - both just render different slices/links over the same app list. */
export async function fetchAllApps(): Promise<AppData[]> {
  const res = await fetch("/api/apps");
  if (!res.ok) throw new Error(`GET /api/apps failed: ${res.status}`);
  const data = await res.json();
  return (data.apps as ApiApp[]).map(toAppData);
}

/**
 * POSTs to a route that may briefly 409 while BlockchainListener's async indexing catches up
 * with a transaction that just confirmed (e.g. attaching an icon or release notes right after
 * publishApp()/publishNewVersion() mines) - retries a few times on 409 specifically, since
 * that's what these routes return for "the row isn't indexed yet", then gives up.
 */
export async function postWithRetryUntilIndexed(url: string, body: unknown): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return;
    if (res.status !== 409) {
      console.error(`POST ${url} failed:`, await res.text().catch(() => ""));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.error(`POST ${url} failed: target was never indexed`);
}
