"use client";

import Link from "next/link";
import { Badge, Card, SimpleGrid, Text, Title } from "@mantine/core";
import RatingStars from "./RatingStars";

export interface AppVersion {
  versionId: number;
  torrentRef: string;
  sha256Digest: string;
  publishedAt: string;
}

// Shape returned by GET /api/apps (a Prisma App row + its versions), which mirrors the
// on-chain App struct plus cache-only rollups (averageRating/reportCount) computed server-side.
export interface AppData {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  rating: number;
  ratingCount: number;
  reportCount: number;
  version: string;
  publisher: string;
  publisherName: string | null;
  versions: AppVersion[];
}

interface AppListProps {
  apps: AppData[];
  hrefBase: string;
  emptyMessage?: string;
}

export default function AppList({ apps, hrefBase, emptyMessage = "No apps to show yet." }: AppListProps) {
  if (apps.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        {emptyMessage}
      </Text>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
      {apps.map((app) => (
        <Card
          key={app.id}
          component={Link}
          href={`${hrefBase}/${app.id}`}
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <Badge variant="light" color="brand" mb="sm">
            {app.category}
          </Badge>
          <Title order={4} mb={4}>
            {app.name}
          </Title>
          <Text c="dimmed" size="sm" lineClamp={2} mb="md">
            {app.description}
          </Text>
          <RatingStars value={app.rating} count={app.ratingCount} />
        </Card>
      ))}
    </SimpleGrid>
  );
}
