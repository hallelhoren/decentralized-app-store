"use client";

import Link from "next/link";
import { Avatar, Badge, Card, Group, SimpleGrid, Text, Title } from "@mantine/core";
import RatingStars from "./RatingStars";

export interface AppVersion {
  versionId: number;
  torrentRef: string;
  sha256Digest: string;
  publishedAt: string;
  releaseNotes: string | null;
}

// Shape returned by GET /api/apps (a Prisma App row + its versions), which mirrors the
// on-chain App struct plus cache-only rollups (averageRating/reportCount) computed server-side.
export interface AppData {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  icon: string | null;
  rating: number;
  ratingCount: number;
  reportCount: number;
  downloadCount: number;
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
          <Group gap="sm" mb="sm">
            <Avatar src={app.icon ?? undefined} radius="xl" size="md">
              {app.name[0]?.toUpperCase()}
            </Avatar>
            <Badge variant="light" color="brand">
              {app.category}
            </Badge>
          </Group>
          <Title order={4} mb={4}>
            {app.name}
          </Title>
          <Text c="dimmed" size="sm" lineClamp={2} mb="md">
            {app.description}
          </Text>
          <RatingStars value={app.rating} count={app.ratingCount} />
          <Text c="dimmed" size="xs" mt={4}>
            ⬇ {app.downloadCount} download{app.downloadCount === 1 ? "" : "s"}
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}
