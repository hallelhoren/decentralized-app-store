import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { prisma } from "@/lib/db";
import { buildReportMessage } from "@/lib/report-signing";
import { maybeAggregateReports, refreshReportCount } from "@/lib/reports-aggregator";

// Reports accumulate here off-chain (no gas, no on-chain transaction per report - see
// reports-aggregator.ts for how they eventually get anchored on-chain in batches). This route
// just exposes what's in Postgres, same as api/reviews/route.ts does for reviews.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const appIdParam = searchParams.get("appId");

    if (!appIdParam) {
      return NextResponse.json({ error: "Missing appId parameter" }, { status: 400 });
    }

    const reports = await prisma.report.findMany({
      where: { appId: Number(appIdParam) },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      reports: reports.map((r) => ({
        id: String(r.id),
        reporter: r.reporter,
        reason: r.reason,
        timestamp: r.createdAt.getTime(),
      })),
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { appId, reason, signature } = body;

    if (!appId || !reason || !signature) {
      return NextResponse.json({ error: "appId, reason and signature are required" }, { status: 400 });
    }

    const appIdNum = Number(appId);
    const trimmedReason = String(reason).trim();
    if (!trimmedReason) {
      return NextResponse.json({ error: "reason cannot be empty" }, { status: 400 });
    }

    // The reporter's address is derived purely from signature recovery, never trusted from the
    // request body - this is what replaces the old on-chain reportApp()'s guarantee that only
    // the reporter's own wallet could have authored the report, without requiring a paid
    // transaction to prove it.
    let reporter: string;
    try {
      const message = buildReportMessage(appIdNum, trimmedReason);
      reporter = ethers.verifyMessage(message, signature);
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const existing = await prisma.report.findUnique({
      where: { appId_reporter: { appId: appIdNum, reporter } },
    });
    if (existing) {
      return NextResponse.json({ error: "You have already reported this app" }, { status: 409 });
    }

    await prisma.report.create({
      data: { appId: appIdNum, reporter, reason: trimmedReason, signature },
    });

    await refreshReportCount(appIdNum);

    // Best-effort: aggregation talks to the desktop client + blockchain, neither of which the
    // reporter submitting a reason should have to wait on or fail because of.
    maybeAggregateReports(appIdNum).catch((err) =>
      console.error(`Background report aggregation failed for app ${appIdNum}:`, err)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/reports:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
