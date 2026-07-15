import { PrismaClient } from "@prisma/client";

// Standard Next.js pattern: stash the client on `globalThis` in dev so hot-reloading
// route handlers doesn't spawn a fresh Postgres connection pool on every edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
