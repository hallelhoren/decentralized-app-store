import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startDesktopDownload } from "@/lib/desktop-client";

// Looks up the app's latest torrent reference + expected SHA-256 digest from the indexed
// cache (never the chain directly - that's the whole point of the cache layer), then hands
// off to the desktop client to actually pull the file over BitTorrent and verify it.
export async function POST(request: Request) {
  try {
    const { appId } = await request.json();
    if (!appId) return NextResponse.json({ error: "No App ID" }, { status: 400 });

    const app = await prisma.app.findUnique({ where: { id: Number(appId) } });
    if (!app) return NextResponse.json({ error: "App not found in cache" }, { status: 404 });

    const latestVersion = await prisma.version.findUnique({
      where: { appId_versionId: { appId: app.id, versionId: app.latestVersionId } },
    });
    if (!latestVersion) {
      return NextResponse.json({ error: "Latest version not indexed yet" }, { status: 409 });
    }

    const result = await startDesktopDownload(appId, latestVersion.torrentRef, latestVersion.sha256Digest);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/download:", error);
    return NextResponse.json(
      { error: "Failed to start download", details: String(error) },
      { status: 502 }
    );
  }
}
