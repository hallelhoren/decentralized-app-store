"use client";

import { Chip, Group, Select, TextInput } from "@mantine/core";

export interface SearchFilters {
  search: string;
  category: string;
  minRating: number;
}

interface SearchBarProps {
  filters: SearchFilters;
  categories: string[];
  onChange: (filters: SearchFilters) => void;
}

export default function SearchBar({ filters, categories, onChange }: SearchBarProps) {
  return (
    <Group mb="lg" align="flex-end" wrap="wrap">
      <TextInput
        placeholder="Search apps by name..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.currentTarget.value })}
        style={{ flex: 1, minWidth: 220 }}
      />
      <Select
        placeholder="Any rating"
        data={["4+ stars", "3+ stars", "2+ stars", "1+ stars"]}
        value={filters.minRating > 0 ? `${filters.minRating}+ stars` : null}
        onChange={(value) => onChange({ ...filters, minRating: value ? Number(value[0]) : 0 })}
        clearable
        w={160}
      />

      <Chip.Group
        value={filters.category}
        onChange={(value) => onChange({ ...filters, category: Array.isArray(value) ? value[0] ?? "" : value })}
      >
        <Group gap="xs">
          <Chip value="" variant="light">
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c} value={c} variant="light">
              {c}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </Group>
  );
}
