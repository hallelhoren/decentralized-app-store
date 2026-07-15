"use client";

import { useEffect, useState } from "react";
import { Container } from "@mantine/core";
import UserProfile from "../../components/UserProfile";
import { fetchAllApps } from "../../lib/apps-client";
import { useWallet } from "../../lib/wallet-context";

export default function ProfilePage() {
  const { walletAddress, connect } = useWallet();
  const [appCount, setAppCount] = useState(0);

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

  return (
    <Container size="lg" py="xl">
      <UserProfile appCount={appCount} walletAddress={walletAddress} onConnectWallet={connect} />
    </Container>
  );
}
