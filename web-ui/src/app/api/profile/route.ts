import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const MAX_USERNAME_LENGTH = 32;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("walletAddress")?.trim().toLowerCase();
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { walletAddress } });
  return NextResponse.json({ username: user?.username ?? null });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim().toLowerCase() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }
  if (!username || username.length > MAX_USERNAME_LENGTH) {
    return NextResponse.json(
      { error: `username must be 1-${MAX_USERNAME_LENGTH} characters` },
      { status: 400 }
    );
  }

  const user = await prisma.user.upsert({
    where: { walletAddress },
    update: { username },
    create: { walletAddress, username },
  });

  return NextResponse.json({ username: user.username });
}
