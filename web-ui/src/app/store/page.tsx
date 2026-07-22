"use client";

import { useCallback, useEffect, useState } from "react";
import { Container, Title } from "@mantine/core";
import AppList, { AppData } from "../../components/AppList";
import SearchBar, { SearchFilters } from "../../components/SearchBar";
import { toAppData, type ApiApp } from "../../lib/apps-client";
import { APP_CATEGORIES } from "../../constants/categories";

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

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="lg">
        Browse Apps
      </Title>
      <SearchBar filters={filters} categories={[...APP_CATEGORIES]} onChange={setFilters} />
      <AppList apps={apps} hrefBase="/store" emptyMessage="No apps match your search." />
    </Container>
  );
}
