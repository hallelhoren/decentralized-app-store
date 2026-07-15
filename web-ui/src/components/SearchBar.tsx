"use client";

import type { CSSProperties } from "react";

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

const selectStyle: CSSProperties = {
  padding: "12px 16px",
  borderRadius: "8px",
  border: "1px solid #334155",
  backgroundColor: "#1e293b",
  color: "white",
};

export default function SearchBar({ filters, categories, onChange }: SearchBarProps) {
  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
      <input
        type="text"
        placeholder="Search apps by name..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        style={{ ...selectStyle, flex: 1, minWidth: "200px" }}
      />
      <select
        value={filters.category}
        onChange={(e) => onChange({ ...filters, category: e.target.value })}
        style={selectStyle}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select
        value={filters.minRating}
        onChange={(e) => onChange({ ...filters, minRating: Number(e.target.value) })}
        style={selectStyle}
      >
        <option value={0}>Any rating</option>
        {[4, 3, 2, 1].map((r) => (
          <option key={r} value={r}>{r}+ stars</option>
        ))}
      </select>
    </div>
  );
}
