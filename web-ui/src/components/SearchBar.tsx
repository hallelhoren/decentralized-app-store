"use client";

export default function SearchBar({ onSearch }: { onSearch: (term: string) => void }) {
  return (
    <input
      type="text"
      placeholder="Search apps by name..."
      onChange={(e) => onSearch(e.target.value)}
      style={{
        width: "100%",
        padding: "12px 16px",
        borderRadius: "8px",
        border: "1px solid #334155",
        backgroundColor: "#1e293b",
        color: "white",
        marginBottom: "24px",
      }}
    />
  );
}