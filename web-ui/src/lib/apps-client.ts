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
  versions: { versionId: number; torrentRef: string; sha256Digest: string; publishedAt: string }[];
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
