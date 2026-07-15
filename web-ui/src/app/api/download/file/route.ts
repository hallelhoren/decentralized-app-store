import { NextResponse } from "next/server";
import { fetchDesktopDownloadFile } from "@/lib/desktop-client";

// Streams the completed download straight through from the desktop client so the browser
// gets a real file response - with the desktop client's Content-Disposition header intact -
// from the same origin as the web app, instead of the UI having no way to hand the user
// an actual file at all.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get("appId");
  if (!appId) {
    return NextResponse.json({ error: "appId is required" }, { status: 400 });
  }

  const upstream = await fetchDesktopDownloadFile(appId);
  if (!upstream.ok || !upstream.body) {
    const body = await upstream.json().catch(() => ({ error: "Failed to fetch file from desktop client" }));
    return NextResponse.json(body, { status: upstream.status || 502 });
  }

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") || "application/octet-stream");
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);

  return new NextResponse(upstream.body, { status: 200, headers });
}
