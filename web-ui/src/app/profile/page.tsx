"use client";

import { useEffect, useState } from "react";
import { Container } from "@mantine/core";
import UserProfile from "../../components/UserProfile";
import { fetchAllApps } from "../../lib/apps-client";
import { useWallet } from "../../lib/wallet-context";

export default function ProfilePage() {
  const { walletAddress, connect } = useWallet();
  const [appCount, setAppCount] = useState(0);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setAppCount(0);
      return;
    }
    fetchAllApps()
      .then((apps) => {
        setAppCount(apps.filter((a) => a.publisher.toLowerCase() === walletAddress.toLowerCase()).length);
      })
      .catch((error) => console.error("Error loading apps:", error));
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) {
      setUsername(null);
      return;
    }
    fetch(`/api/profile?walletAddress=${encodeURIComponent(walletAddress)}`)
      .then((res) => res.json())
      .then((data) => setUsername(data.username ?? null))
      .catch((error) => console.error("Error loading username:", error));
  }, [walletAddress]);

  const handleSaveUsername = async (newUsername: string) => {
    if (!walletAddress) return;
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, username: newUsername }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      alert(body?.error || "Failed to save username");
      return;
    }
    const data = await res.json();
    setUsername(data.username);
  };

  return (
    <Container size="lg" py="xl">
      <UserProfile
        appCount={appCount}
        walletAddress={walletAddress}
        onConnectWallet={connect}
        username={username}
        onSaveUsername={handleSaveUsername}
      />
    </Container>
  );
}
