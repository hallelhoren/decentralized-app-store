import { NextResponse } from 'next/server';
import { activeDownloads } from '@/lib/store';

export async function POST(request: Request) {
  const { appId } = await request.json();
  if (!appId) return NextResponse.json({ error: "No App ID" }, { status: 400 });
  
  activeDownloads.set(appId, Date.now());
  return NextResponse.json({ status: "started" });
}