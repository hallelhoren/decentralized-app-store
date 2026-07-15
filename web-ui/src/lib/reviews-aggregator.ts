import crypto from "crypto";
import { prisma } from "./db";
import { seedContentOnDesktopClient } from "./desktop-client";
import { getAggregatorContract } from "./aggregator-wallet";

export const AGGREGATION_THRESHOLD = 5;

/**
 * Implements the hash-chaining aggregation model the team designed: once enough new reviews
 * pile up, the full review history for an app is serialized, hashed, and seeded to BitTorrent;
 * only the resulting hash + torrent reference get anchored on-chain via updateReviews. Review
 * rows themselves are marked `aggregated`, never deleted, so the full history keeps being
 * servable from Postgres for the details page.
 */
export async function maybeAggregateReviews(appId: number): Promise<void> {
  const pendingCount = await prisma.review.count({ where: { appId, aggregated: false } });
  if (pendingCount < AGGREGATION_THRESHOLD) return;

  const allReviews = await prisma.review.findMany({
    where: { appId },
    orderBy: { createdAt: "asc" },
  });

  const payload = JSON.stringify(
    allReviews.map((r) => ({
      reviewer: r.reviewer,
      rating: r.rating,
      reviewText: r.reviewText,
      isDeveloper: r.isDeveloper,
      timestamp: r.createdAt.getTime(),
    }))
  );
  const newReviewsHash = "0x" + crypto.createHash("sha256").update(payload).digest("hex");

  let torrentRef = "";
  try {
    const seeded = await seedContentOnDesktopClient(`reviews-${appId}-${Date.now()}.json`, payload);
    torrentRef = seeded.magnetLink;
  } catch (err) {
    console.warn(
      `[reviews-aggregator] could not seed aggregated reviews for app ${appId} (desktop client offline?):`,
      err
    );
    // Still anchor the hash on-chain even if seeding failed - torrentRef stays empty and can
    // be backfilled by re-seeding the same payload later, since the hash is deterministic.
  }

  try {
    await anchorReviewsHashOnChain(appId, newReviewsHash, torrentRef);
  } catch (err) {
    console.error(`[reviews-aggregator] failed to anchor reviews hash on-chain for app ${appId}:`, err);
    return; // leave rows unaggregated so the next submission retries the whole batch
  }

  await prisma.review.updateMany({
    where: { appId, aggregated: false },
    data: { aggregated: true },
  });

  await prisma.app.update({
    where: { id: appId },
    data: { latestReviewsHash: newReviewsHash, latestReviewsRef: torrentRef },
  });
}

async function anchorReviewsHashOnChain(appId: number, newReviewsHash: string, torrentRef: string) {
  const contract = getAggregatorContract();
  const tx = await contract.updateReviews(appId, newReviewsHash, torrentRef);
  await tx.wait();
  console.log(`[reviews-aggregator] anchored reviews hash for app ${appId}: ${newReviewsHash}`);
}

/** Recomputes the app's rating rollup from all rated reviews (developer posts have no rating). */
export async function refreshAppRating(appId: number): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { appId, rating: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.app.update({
    where: { id: appId },
    data: {
      averageRating: agg._avg.rating ?? 0,
      ratingCount: agg._count.rating,
    },
  });
}
