import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { maybeAggregateReviews, refreshAppRating } from "@/lib/reviews-aggregator";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const appIdParam = searchParams.get("appId");

    if (!appIdParam) {
      return NextResponse.json({ error: "Missing appId parameter" }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where: { appId: Number(appIdParam) },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      reviews: reviews.map((r) => ({
        reviewText: r.reviewText,
        rating: r.rating ?? undefined,
        isDeveloper: r.isDeveloper,
        reviewer: r.reviewer,
        timestamp: r.createdAt.getTime(),
      })),
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { appId, rating, reviewText, isDeveloper, reviewer } = body;

    if (!appId || !reviewText || !reviewer) {
      return NextResponse.json({ error: "appId, reviewText and reviewer are required" }, { status: 400 });
    }

    const appIdNum = Number(appId);

    await prisma.review.create({
      data: {
        appId: appIdNum,
        rating: isDeveloper ? null : rating ?? null,
        reviewText,
        isDeveloper: Boolean(isDeveloper),
        reviewer,
      },
    });

    await refreshAppRating(appIdNum);

    // Best-effort: aggregation talks to the desktop client + blockchain, neither of which the
    // reviewer submitting a comment should have to wait on or fail because of.
    maybeAggregateReviews(appIdNum).catch((err) =>
      console.error(`Background review aggregation failed for app ${appIdNum}:`, err)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/reviews:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
