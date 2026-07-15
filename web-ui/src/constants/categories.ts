// Single source of truth for the predefined category list, shared by the upload form (what a
// publisher can choose from) and the store page's filter (what a browser can filter by). The
// smart contract itself still just takes a string[] of tags - this list is a UI/Prisma-level
// constraint on top of that, not a contract change, so already-published apps with arbitrary
// free-text tags keep working unchanged.
export const APP_CATEGORIES = [
  "Games",
  "DeFi & Finance",
  "Utilities & Tools",
  "Social",
  "Productivity",
  "Education",
  "Entertainment",
  "Health & Fitness",
  "Marketplaces",
  "Other",
] as const;

export type AppCategory = (typeof APP_CATEGORIES)[number];
