"use client";

// This component will display the details of a selected app, including its name, description, version, rating, and a download button.
// It will also include a comments section where the developer can leave feedback and ratings for the app.

import { useState } from "react";
import DownloadButton from "./DownloadButton";
import { AppData } from "./AppList";
import CommentsSection, { AppComment } from "./CommentsSection";

interface DeveloperAppDetailsProps {
  app: AppData;
  onBack: () => void;
  onUpdateVersion: (id: string, newVersion: string) => void;
  comments: AppComment[];
  onAddComment: (text: string) => void;
}

export default function DeveloperAppDetails({ app, onBack, onUpdateVersion, comments, onAddComment }: DeveloperAppDetailsProps) {
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [newVersion, setNewVersion] = useState("");

  const handleUpdate = () => {
    if (newVersion) {
      onUpdateVersion(app.id, newVersion);
      setShowUpdateForm(false);
      setNewVersion("");
    }
  };

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontWeight: "bold", marginBottom: "24px" }}>
        ← Back to Developer Studio
      </button>

      <div style={{ backgroundColor: "#1e293b", padding: "32px", borderRadius: "16px", border: "1px solid #334155" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ backgroundColor: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", fontSize: "12px", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" }}>Your App</span>
            <h2 style={{ color: "#f8fafc", margin: "16px 0 8px 0" }}>{app.name}</h2>
            <div style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "24px" }}>Current Version: {app.version}</div>
          </div>
        </div>

        <p style={{ color: "#cbd5e1", marginBottom: "24px" }}>{app.description}</p>
        
        <div style={{ backgroundColor: "#0f172a", padding: "16px", borderRadius: "8px", border: "1px dashed #3b82f6", marginBottom: "24px" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "#3b82f6" }}>Developer Actions</h4>
          <div style={{ display: "flex", gap: "16px", flexDirection: "column" }}>
            <DownloadButton appId={app.id} />
            {!showUpdateForm ? (
              <button onClick={() => setShowUpdateForm(true)} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #f59e0b", backgroundColor: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", fontWeight: "bold", cursor: "pointer" }}>Upload New Version</button>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <input placeholder="e.g. 1.0.1" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#1e293b", color: "white" }} />
                <button onClick={handleUpdate} style={{ padding: "0 20px", borderRadius: "8px", border: "none", backgroundColor: "#f59e0b", color: "white", fontWeight: "bold", cursor: "pointer" }}>Save</button>
                <button onClick={() => setShowUpdateForm(false)} style={{ padding: "0 20px", borderRadius: "8px", border: "1px solid #64748b", backgroundColor: "transparent", color: "#cbd5e1", cursor: "pointer" }}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        <CommentsSection 
          appId={app.id}
          comments={comments} 
          onReviewSubmitted={(text) => onAddComment(text)} 
          isDeveloperMode={true} 
        />
      </div>
    </div>
  );
}