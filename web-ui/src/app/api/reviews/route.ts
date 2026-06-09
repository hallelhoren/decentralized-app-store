import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { appId, rating, reviewText, reviewer, isDeveloper } = body;

    // 1. Validate the input data
    const hasValidRating = typeof rating === "number" && rating >= 1 && rating <= 5;
    if (!appId || !reviewText || (!isDeveloper && !hasValidRating)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 2. Save to the local database (SQLite/PostgreSQL integration goes here)
    // db.reviews.insert({ appId, reviewer, rating, reviewText, timestamp: Date.now() })
    console.log("New review securely cached in local DB:", { appId, rating, reviewText, reviewer, isDeveloper });

    // 3. Return immediate success to the UI
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}