"use client";

import { useEffect, useState } from "react";
import { Badge, Loader, Tooltip } from "@mantine/core";
import { verifyProof } from "../lib/merkle";
import { getOnChainMerkleRoot } from "../lib/blockchain";

type Status = "checking" | "verified" | "mismatch" | "error";

/**
 * Proves the cache server isn't lying about this app's core on-chain facts (publisher, name,
 * latest version's torrent ref + hash) without trusting the cache server itself: fetches a
 * Merkle proof from the cache, but checks it against a root read directly from the chain -
 * see src/lib/merkle.ts and DappStore.sol's updateMerkleRoot.
 */
export default function VerifyBadge({ appId }: { appId: string }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [proofRes, onChainRoot] = await Promise.all([
          fetch(`/api/apps/${appId}/proof`).then((r) => {
            if (!r.ok) throw new Error(`proof fetch failed: ${r.status}`);
            return r.json();
          }),
          getOnChainMerkleRoot(),
        ]);

        const ok = verifyProof(proofRes.leaf, proofRes.proof, onChainRoot);
        if (!cancelled) setStatus(ok ? "verified" : "mismatch");
      } catch (err) {
        console.error("Merkle verification failed:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appId]);

  if (status === "checking") {
    return (
      <Badge variant="light" color="gray" leftSection={<Loader size={10} />}>
        Verifying...
      </Badge>
    );
  }

  if (status === "verified") {
    return (
      <Tooltip label="This app's data matches a Merkle root read directly from the blockchain, not just what the cache server claims.">
        <Badge variant="light" color="green">
          ✓ Verified on-chain
        </Badge>
      </Tooltip>
    );
  }

  if (status === "mismatch") {
    return (
      <Tooltip label="The cache server's data does not match the root anchored on-chain. Do not trust this listing.">
        <Badge variant="light" color="red">
          ✗ Verification mismatch
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip label="Could not reach the chain or cache server to verify.">
      <Badge variant="light" color="gray">
        Verification unavailable
      </Badge>
    </Tooltip>
  );
}
