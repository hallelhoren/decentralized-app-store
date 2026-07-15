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

    return NextResponse.json({ apps });
  } catch (error) {
    console.error("Error in GET /api/apps:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
