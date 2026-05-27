"use client";

export default function UserProfile({ appCount }: { appCount: number }) {
  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: "#1e293b", padding: "32px", borderRadius: "16px", border: "1px solid #334155" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "32px" }}>
        <div style={{ width: "80px", height: "80px", backgroundColor: "#3b82f6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", fontWeight: "bold" }}>
          JD
        </div>
        <div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", color: "#f8fafc" }}>Jane Doe</h2>
          <p style={{ margin: 0, color: "#94a3b8", fontFamily: "monospace" }}>Wallet: 0x8A23...F91A</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" }}>
        <div style={{ backgroundColor: "#0f172a", padding: "16px", borderRadius: "8px", border: "1px solid #1e293b" }}>
          <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "8px" }}>Joined</div>
          <div style={{ color: "#f8fafc", fontSize: "18px", fontWeight: "600" }}>March 2024</div>
        </div>
        <div style={{ backgroundColor: "#0f172a", padding: "16px", borderRadius: "8px", border: "1px solid #1e293b" }}>
          <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "8px" }}>Apps Published</div>
          <div style={{ color: "#f8fafc", fontSize: "18px", fontWeight: "600" }}>{appCount}</div>
        </div>
      </div>

      <p style={{ color: "#cbd5e1", lineHeight: "1.6" }}>
        Smart contract developer specializing in decentralized finance and peer-to-peer applications.
      </p>
    </div>
  );
}