"use client";

import { useState } from "react";
import { AppService } from "../lib/api-service"; // Importing our abstraction

export default function UploadAppForm({ onCancel, onSubmit }: { 
  onCancel: () => void, 
  onSubmit: (app: any) => void 
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const appData = {
      name,
      description,
      category: "Tools",
      version,
      // Backend will handle ID and contractAddress generation
    };

    try {
      // Connect to the Backend Pipeline
      const newApp = await AppService.uploadApp(appData);
      onSubmit(newApp); // Update UI
    } catch (error) {
      console.error("Failed to upload app:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto", backgroundColor: "#1e293b", padding: "32px", borderRadius: "16px", border: "1px solid #334155" }}>
      <h2 style={{ marginTop: 0, color: "#f8fafc" }}>Upload New dApp</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <input 
          placeholder="App Name" value={name} onChange={(e) => setName(e.target.value)} required
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }} 
        />
        <textarea 
          placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={4}
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }} 
        />
        <input 
          placeholder="Version (e.g. 1.0.0)" value={version} onChange={(e) => setVersion(e.target.value)} required
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }} 
        />

        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: isSubmitting ? "#64748b" : "#10b981", color: "white", fontWeight: "bold", cursor: "pointer" }}>
            {isSubmitting ? "Publishing..." : "Publish"}
          </button>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #64748b", backgroundColor: "transparent", color: "#cbd5e1", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}