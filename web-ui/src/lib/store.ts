const globalAny = global as any;

if (!globalAny.activeDownloads) {
  globalAny.activeDownloads = new Map<string, number>();
}

export const activeDownloads: Map<string, number> = globalAny.activeDownloads;