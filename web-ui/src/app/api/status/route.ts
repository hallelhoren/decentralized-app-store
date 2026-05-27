import { NextResponse } from 'next/server';
import { activeDownloads } from '@/lib/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('appId');

  // Handle case where appId is missing
  if (!appId) {
    return NextResponse.json({ status: "idle", progress: 0 });
  }

  if (!activeDownloads.has(appId)) {
    return NextResponse.json({ status: "idle", progress: 0 });
  }

  const startTime = activeDownloads.get(appId)!;
  const elapsed = (Date.now() - startTime) / 1000;
  const progress = Math.min(Math.floor(elapsed * 10), 100);

  if (progress >= 100) {
    activeDownloads.delete(appId);
    return NextResponse.json({ status: "finished", progress: 100 });
  }

  return NextResponse.json({ status: "in_progress", progress });
}