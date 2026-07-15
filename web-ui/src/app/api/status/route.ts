import { NextResponse } from "next/server";
import { getDesktopDownloadStatus } from "@/lib/desktop-client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get("appId");

  if (!appId) {
    return NextResponse.json({ status: "idle", progress: 0, verified: null });
  }

  try {
    const status = await getDesktopDownloadStatus(appId);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Error in GET /api/status:", error);
    // The desktop client not being reachable yet (still starting up, or not running at all)
    // is a very normal transient state here - report idle rather than a hard failure so the
    // UI's poll loop keeps retrying instead of breaking.
    return NextResponse.json({ status: "idle", progress: 0, verified: null });
  }
}
