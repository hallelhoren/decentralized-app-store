"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Container, Title } from "@mantine/core";
import AppList, { AppData } from "../../components/AppList";
import SearchBar, { SearchFilters } from "../../components/SearchBar";
import { toAppData, type ApiApp } from "../../lib/apps-client";

export default function StorePage() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({ search: "", category: "", minRating: 0 });

  const loadApps = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.category) params.set("category", filters.category);
      if (filters.minRating) params.set("minRating", String(filters.minRating));

      const res = await fetch(`/api/apps?${params.toString()}`);
      if (!res.ok) throw new Error(`GET /api/apps failed: ${res.status}`);
      const data = await res.json();
      setApps((data.apps as ApiApp[]).map(toAppData));
    } catch (error) {
      console.error("Error loading apps:", error);
    }
  }, [filters]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  // Categories come from the unfiltered set so the chip list doesn't shrink as you filter -
  // fetched once, separately from the filtered `apps` list above.
  const [allCategories, setAllCategories] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/apps")
      .then((res) => res.json())
      .then((data) => {
        const categories = Array.from(new Set((data.apps as ApiApp[]).map((a) => a.tags[0] || "General")));
        setAllCategories(categories.sort());
      })
      .catch((error) => console.error("Error loading categories:", error));
  }, []);

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="lg">
        Browse Apps
      </Title>
      <SearchBar filters={filters} categories={allCategories} onChange={setFilters} />
      <AppList apps={apps} hrefBase="/store" emptyMessage="No apps match your search." />
    </Container>
  );
}
