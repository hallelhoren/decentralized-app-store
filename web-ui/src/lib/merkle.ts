import { ethers } from "ethers";

// Standard binary Merkle tree over keccak256 leaves, sibling pairs sorted before hashing so a
// proof never needs to carry left/right position - this is the same scheme used by
// OpenZeppelin's MerkleProof.sol, kept here as plain TS since only the *client* needs to verify
// proofs (the contract just stores the root, see updateMerkleRoot in DappStore.sol).

export interface MerkleAppLeafInput {
  appId: number;
  publisher: string;
  name: string;
  latestVersionId: number;
  torrentRef: string;
  sha256Digest: string; // bytes32 hex string
}

/**
 * Canonical leaf hash for one app. Deliberately only the fields that actually originated
 * on-chain (id/publisher/name/latest version's torrent+hash) - not cache-only rollups like
 * averageRating/reportCount. The point of this proof is "is the cache lying about which binary
 * is authoritative for this app", not verifying subjective aggregates.
 */
export function hashAppLeaf(app: MerkleAppLeafInput): string {
  return ethers.solidityPackedKeccak256(
    ["uint256", "address", "string", "uint256", "string", "bytes32"],
    [app.appId, app.publisher, app.name, app.latestVersionId, app.torrentRef, app.sha256Digest]
  );
}

function hashPair(a: string, b: string): string {
  const [lo, hi] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  return ethers.keccak256(ethers.concat([lo, hi]));
}

/** layers[0] = leaves, layers[last] = [root]. An unpaired node at any level is promoted as-is. */
export function buildLayers(leaves: string[]): string[][] {
  if (leaves.length === 0) return [[ethers.ZeroHash]];

  const layers: string[][] = [leaves];
  let current = leaves;
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(i + 1 < current.length ? hashPair(current[i], current[i + 1]) : current[i]);
    }
    layers.push(next);
    current = next;
  }
  return layers;
}

export function getRoot(layers: string[][]): string {
  return layers[layers.length - 1][0];
}

/** Sibling hashes from the leaf at `index` up to (not including) the root. */
export function getProof(layers: string[][], index: number): string[] {
  const proof: string[] = [];
  let idx = index;
  for (let level = 0; level < layers.length - 1; level++) {
    const layer = layers[level];
    const siblingIndex = idx % 2 === 1 ? idx - 1 : idx + 1;
    if (siblingIndex < layer.length) proof.push(layer[siblingIndex]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

/** Recomputes the root from a leaf + proof - the actual trustless check the browser runs
 * against the root it read directly from the chain (never from the cache server). */
export function verifyProof(leaf: string, proof: string[], root: string): boolean {
  let computed = leaf;
  for (const sibling of proof) computed = hashPair(computed, sibling);
  return computed.toLowerCase() === root.toLowerCase();
}

export interface AppForMerkle {
  id: number;
  publisher: string;
  name: string;
  latestVersionId: number;
  versions: { versionId: number; torrentRef: string; sha256Digest: string }[];
}

/** Builds the tree over the current app listing, ordered by id so the same input set always
 * produces the same tree (order only changes between snapshots when the app set itself changes,
 * which is exactly when a fresh root should be anchored anyway). */
export function buildAppTree(apps: AppForMerkle[]): { layers: string[][]; ids: number[] } {
  const sorted = [...apps].sort((a, b) => a.id - b.id);
  const leaves = sorted.map((app) => {
    const latestVersion = app.versions.find((v) => v.versionId === app.latestVersionId);
    return hashAppLeaf({
      appId: app.id,
      publisher: app.publisher,
      name: app.name,
      latestVersionId: app.latestVersionId,
      torrentRef: latestVersion?.torrentRef ?? "",
      sha256Digest: latestVersion?.sha256Digest ?? ethers.ZeroHash,
    });
  });

  return { layers: buildLayers(leaves), ids: sorted.map((a) => a.id) };
}
