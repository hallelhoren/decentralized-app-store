import crypto from "crypto";
import { prisma } from "./db";
import { seedContentOnDesktopClient } from "./desktop-client";
import { getAggregatorContract } from "./aggregator-wallet";

export const REPORT_AGGREGATION_THRESHOLD = 5;

/**
 * Same hash-chaining aggregation model as reviews-aggregator.ts, applied to reports: once
 * enough new reports pile up, the full report history for an app is serialized, hashed, and
 * seeded to BitTorrent; only the resulting hash + torrent reference get anchored on-chain via
 * updateReports. Report rows themselves are marked `aggregated`, never deleted, so the full
 * history keeps being servable from Postgres for the Reports tab.
 */
export async function maybeAggregateReports(appId: number): Promise<void> {
  const pendingCount = await prisma.report.count({ where: { appId, aggregated: false } });
  if (pendingCount < REPORT_AGGREGATION_THRESHOLD) return;

  const allReports = await prisma.report.findMany({
    where: { appId },
    orderBy: { createdAt: "asc" },
  });

  const payload = JSON.stringify(
    allReports.map((r) => ({
      reporter: r.reporter,
      reason: r.reason,
      timestamp: r.createdAt.getTime(),
    }))
  );
  const newReportsHash = "0x" + crypto.createHash("sha256").update(payload).digest("hex");

  let torrentRef = "";
  try {
    const seeded = await seedContentOnDesktopClient(`reports-${appId}-${Date.now()}.json`, payload);
    torrentRef = seeded.magnetLink;
  } catch (err) {
    console.warn(
      `[reports-aggregator] could not seed aggregated reports for app ${appId} (desktop client offline?):`,
      err
    );
    // Still anchor the hash on-chain even if seeding failed - torrentRef stays empty and can
    // be backfilled by re-seeding the same payload later, since the hash is deterministic.
  }

  try {
    await anchorReportsHashOnChain(appId, newReportsHash, torrentRef);
  } catch (err) {
    console.error(`[reports-aggregator] failed to anchor reports hash on-chain for app ${appId}:`, err);
    return; // leave rows unaggregated so the next submission retries the whole batch
  }

  await prisma.report.updateMany({
    where: { appId, aggregated: false },
    data: { aggregated: true },
  });

  await prisma.app.update({
    where: { id: appId },
    data: { latestReportsHash: newReportsHash, latestReportsRef: torrentRef },
  });
}

async function anchorReportsHashOnChain(appId: number, newReportsHash: string, torrentRef: string) {
  const contract = getAggregatorContract();
  const tx = await contract.updateReports(appId, newReportsHash, torrentRef);
  await tx.wait();
  console.log(`[reports-aggregator] anchored reports hash for app ${appId}: ${newReportsHash}`);
}

/** Recomputes the app's report count rollup from all reports on file (pending + aggregated) -
 * cache-only, same treatment as refreshAppRating(), never itself anchored on-chain. */
export async function refreshReportCount(appId: number): Promise<void> {
  const count = await prisma.report.count({ where: { appId } });
  await prisma.app.update({ where: { id: appId }, data: { reportCount: count } });
}
