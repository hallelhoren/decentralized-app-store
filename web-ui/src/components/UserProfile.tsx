"use client";

interface UserProfileProps {
  appCount: number;
  walletAddress: string | null;
  onConnectWallet: () => void;
}

export default function UserProfile({ appCount, walletAddress, onConnectWallet }: UserProfileProps) {
  const initials = walletAddress ? walletAddress.slice(2, 4).toUpperCase() : "?";
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: "#1e293b", padding: "32px", borderRadius: "16px", border: "1px solid #334155" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "32px" }}>
        <div style={{ width: "80px", height: "80px", backgroundColor: "#3b82f6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: "bold" }}>
          {initials}
        </div>
        <div>
          {walletAddress ? (
            <>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", color: "#f8fafc", fontFamily: "monospace" }}>{shortAddress}</h2>
              <p style={{ margin: 0, color: "#94a3b8" }}>Connected wallet</p>
            </>
          ) : (
            <>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", color: "#f8fafc" }}>No wallet connected</h2>
              <button
                onClick={onConnectWallet}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "bold", cursor: "pointer" }}
              >
                Connect Wallet
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
        <div style={{ backgroundColor: "#0f172a", padding: "16px", borderRadius: "8px", border: "1px solid #1e293b" }}>
          <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "8px" }}>Apps Published</div>
          <div style={{ color: "#f8fafc", fontSize: "18px", fontWeight: "600" }}>{appCount}</div>
        </div>
      </div>
    </div>
  );
}
