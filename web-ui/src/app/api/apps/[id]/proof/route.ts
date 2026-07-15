import { NextResponse } from "next/server";
import { ZeroHash } from "ethers";
import { prisma } from "@/lib/db";
import { buildAppTree, hashAppLeaf, getProof, getRoot } from "@/lib/merkle";

// Returns a Merkle proof for one app against the cache's *current* tree, so a client can
// recompute the root client-side and compare it to merkleRoot() read directly from the chain
// (never from this server) - see src/lib/merkle.ts and DappStore.sol's updateMerkleRoot.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const appId = Number(id);

    const apps = await prisma.app.findMany({ include: { versions: true } });
    const app = apps.find((a) => a.id === appId);
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const { layers, ids } = buildAppTree(apps);
    const index = ids.indexOf(appId);
    const latestVersion = app.versions.find((v) => v.versionId === app.latestVersionId);

    const leaf = hashAppLeaf({
      appId: app.id,
      publisher: app.publisher,
      name: app.name,
      latestVersionId: app.latestVersionId,
      torrentRef: latestVersion?.torrentRef ?? "",
      sha256Digest: latestVersion?.sha256Digest ?? ZeroHash,
    });

    return NextResponse.json({
      leaf,
      proof: getProof(layers, index),
      root: getRoot(layers),
    });
  } catch (error) {
    console.error("Error in GET /api/apps/[id]/proof:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
