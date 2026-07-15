import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Search/browse now queries the indexed Postgres cache instead of scanning a client-side
// array - this is the "fast search that the blockchain natively lacks" the HLD calls for,
// and supports category/rating filters the course spec explicitly asks for.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const minRating = Number(searchParams.get("minRating") || 0);

    const apps = await prisma.app.findMany({
      where: {
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        ...(category ? { tags: { has: category } } : {}),
        ...(minRating > 0 ? { averageRating: { gte: minRating } } : {}),
      },
      include: {
        versions: { orderBy: { versionId: "desc" } },
      },
      orderBy: { publishedAt: "desc" },
    });

    // publisherName is a UI-only convenience looked up from our local User table (see
    // api/profile/route.ts) - it's never part of the on-chain App struct, so a publisher who
    // hasn't set one just comes back null and the UI falls back to the truncated address.
    const publisherAddresses = Array.from(new Set(apps.map((a) => a.publisher.toLowerCase())));
    const users = await prisma.user.findMany({ where: { walletAddress: { in: publisherAddresses } } });
    const usernameByAddress = new Map(users.map((u) => [u.walletAddress, u.username]));

    const appsWithPublisherName = apps.map((app) => ({
      ...app,
      publisherName: usernameByAddress.get(app.publisher.toLowerCase()) ?? null,
    }));

    return NextResponse.json({ apps: appsWithPublisherName });
  } catch (error) {
    console.error("Error in GET /api/apps:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
