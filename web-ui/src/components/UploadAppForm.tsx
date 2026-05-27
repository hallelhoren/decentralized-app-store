"use client";

// This component will provide a form for developers to upload their dApps to the store.
// It will include fields for the app name, description, version, and a submit button to publish the app.

import { useState } from "react";

export default function UploadAppForm({ onCancel, onSubmit }: { onCancel: () => void, onSubmit: (app: any) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0.0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: Date.now().toString(),
      name,
      description,
      category: "Tools",
      rating: 0,
      version,
      contractAddress: "0x" + Math.floor(Math.random() * 10000000000000000).toString(16),
    });
  };

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto", backgroundColor: "#1e293b", padding: "32px", borderRadius: "16px", border: "1px solid #334155" }}>
      <h2 style={{ marginTop: 0, color: "#f8fafc" }}>Upload New dApp</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        <input 
          placeholder="App Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }} 
        />
        
        <textarea 
          placeholder="Description" 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          required
          rows={4}
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }} 
        />
        
        <input 
          placeholder="Version (e.g. 1.0.0)" 
          value={version} 
          onChange={(e) => setVersion(e.target.value)} 
          required
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "white" }} 
        />

        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          <button type="submit" style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer" }}>
            Publish
          </button>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #64748b", backgroundColor: "transparent", color: "#cbd5e1", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}