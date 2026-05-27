"use client";

// This component will display a list of available dApps in the store. Each app will show its name, description, category, and rating.
// When a user clicks on an app, it will navigate to the AppDetails component to show more information and allow downloading.

export interface AppData {
  id: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  version: string;
  contractAddress: string;
}

interface AppListProps {
  apps: AppData[];
  onSelectApp: (app: AppData) => void;
}

export default function AppList({ apps, onSelectApp }: AppListProps) {
  return (
    <div style={{ width: "100%" }}>
      <h2 style={{ color: "#f8fafc", marginBottom: "24px", fontSize: "22px", fontWeight: "600" }}>
        Available Applications
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "24px",
        }}
      >
        {apps.map((app) => (
          <div
            key={app.id}
            onClick={() => onSelectApp(app)}
            style={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "24px",
              cursor: "pointer",
              transition: "transform 0.2s, border-color 0.2s",
            }}
          >
            <span
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                color: "#3b82f6",
                fontSize: "12px",
                padding: "4px 8px",
                borderRadius: "4px",
                fontWeight: "600",
              }}
            >
              {app.category}
            </span>
            <h3 style={{ color: "#f8fafc", margin: "14px 0 8px 0", fontSize: "18px", fontWeight: "600" }}>
              {app.name}
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: "0 0 20px 0", lineHeight: "1.5" }}>
              {app.description}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#64748b" }}>
              <span>⭐ {app.rating}</span>
              <span>v{app.version}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}