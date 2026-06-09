"use client";

// This component will display the details of a selected app, including its name, description, version, rating, and a download button.
// It will also include a comments section where users can leave feedback and ratings for the app.

import { AppData } from "./AppList";
import DownloadButton from "./DownloadButton";
import CommentsSection, { AppComment } from "./CommentsSection";

interface AppDetailsProps {
  app: AppData;
  onBack: () => void;
  comments: AppComment[];
  onAddComment: (text: string, rating?: number) => void;
}

export default function AppDetails({ app, onBack, comments, onAddComment }: AppDetailsProps) {
  return (
    <div style={{ width: "100%", maxWidth: "640px", margin: "0 auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "14px", fontWeight: "600", marginBottom: "24px", padding: 0 }}>
        ← Back to Store
      </button>

      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "32px" }}>
        <span style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", fontSize: "12px", padding: "4px 8px", borderRadius: "4px", fontWeight: "600" }}>{app.category}</span>
        <h2 style={{ color: "#f8fafc", fontSize: "26px", margin: "16px 0 8px 0", fontWeight: "700" }}>{app.name}</h2>
        <div style={{ display: "flex", gap: "12px", fontSize: "14px", color: "#94a3b8", marginBottom: "24px" }}>
          <span>Rating: ⭐ {app.rating}</span>
          <span>•</span>
          <span>Version: {app.version}</span>
        </div>
        <p style={{ color: "#cbd5e1", fontSize: "16px", lineHeight: "1.6", margin: "0 0 28px 0" }}>{app.description}</p>
        <div style={{ backgroundColor: "#0f172a", borderRadius: "8px", padding: "14px", fontSize: "12px", fontFamily: "monospace", color: "#64748b", border: "1px solid #1e293b", marginBottom: "28px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ color: "#94a3b8", fontWeight: "bold" }}>Contract:</span> {app.contractAddress}
        </div>
        <DownloadButton appId={app.id} />
        
        <CommentsSection 
          appId={app.id}
          comments={comments} 
          onReviewSubmitted={(text, rating) => onAddComment(text, rating)} 
          isDeveloperMode={false} 
        />
      </div>
    </div>
  );
}