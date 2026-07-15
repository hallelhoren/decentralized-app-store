"use client";

import { Group, Rating, Text } from "@mantine/core";

interface RatingStarsProps {
  value: number;
  count?: number;
  size?: "xs" | "sm" | "md";
}

export default function RatingStars({ value, count, size = "sm" }: RatingStarsProps) {
  return (
    <Group gap={4} wrap="nowrap">
      <Rating value={value} fractions={2} readOnly size={size} />
      <Text size={size} c="dimmed">
        {value.toFixed(1)}
        {count !== undefined ? ` (${count})` : ""}
      </Text>
    </Group>
  );
}
