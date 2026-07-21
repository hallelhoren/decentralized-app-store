import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const MAX_NOTES_LENGTH = 2000;

// Called once, right after a new version's publishNewVersion() transaction confirms - release
// notes are never part of the on-chain Version struct or the smart contract call (see
// dev/[id]/page.tsx), same pattern as the app icon feature.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;
    const appId = Number(id);
    const versionIdNum = Number(versionId);
    if (!Number.isInteger(appId) || !Number.isInteger(versionIdNum)) {
      return NextResponse.json({ error: "Invalid appId or versionId" }, { status: 400 });
    }

    const { releaseNotes } = await request.json();
    const trimmed = typeof releaseNotes === "string" ? releaseNotes.trim() : "";
    if (!trimmed) {
      return NextResponse.json({ error: "releaseNotes cannot be empty" }, { status: 400 });
    }
    if (trimmed.length > MAX_NOTES_LENGTH) {
      return NextResponse.json({ error: `releaseNotes exceeds ${MAX_NOTES_LENGTH} characters` }, { status: 400 });
    }

    await prisma.version.update({
      where: { appId_versionId: { appId, versionId: versionIdNum } },
      data: { releaseNotes: trimmed },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // The Version row is created by BlockchainListener's async indexing, which can lag a few
    // seconds behind the publish transaction confirming - the caller retries on this specific
    // "not indexed yet" case rather than treating it as a real failure.
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Version not indexed yet" }, { status: 409 });
    }
    console.error("Error in POST /api/apps/[id]/versions/[versionId]/notes:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
