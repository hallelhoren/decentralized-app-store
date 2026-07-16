import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Matches the client-side cap in UploadAppForm.tsx - enforced again here since the client check
// is only a UX nicety, never something the server can trust on its own.
const MAX_ICON_BYTES = 2 * 1024 * 1024;
const ICON_DATA_URI_PATTERN = /^data:image\/(png|jpeg);base64,([a-zA-Z0-9+/]+=*)$/;

// Called once, right after a new app's on-chain publish transaction confirms (the icon itself
// is never part of the on-chain App struct or the smart contract call - see UploadAppForm.tsx).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const appId = Number(id);
    if (!Number.isInteger(appId)) {
      return NextResponse.json({ error: "Invalid appId" }, { status: 400 });
    }

    const { icon } = await request.json();
    const match = typeof icon === "string" ? icon.match(ICON_DATA_URI_PATTERN) : null;
    if (!match) {
      return NextResponse.json({ error: "icon must be a PNG or JPEG data URI" }, { status: 400 });
    }

    const approxBytes = Math.ceil((match[2].length * 3) / 4);
    if (approxBytes > MAX_ICON_BYTES) {
      return NextResponse.json({ error: "icon exceeds the 2MB size limit" }, { status: 400 });
    }

    await prisma.app.update({ where: { id: appId }, data: { icon } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    // The App row is created by BlockchainListener's async indexing, which can lag a few
    // seconds behind the publish transaction confirming - the caller retries on this specific
    // "not indexed yet" case rather than treating it as a real failure.
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "App not indexed yet" }, { status: 409 });
    }
    console.error("Error in POST /api/apps/[id]/icon:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
