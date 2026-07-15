"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Container, Group, Title } from "@mantine/core";
import AppList, { AppData } from "../../components/AppList";
import UploadAppForm from "../../components/UploadAppForm";
import { fetchAllApps } from "../../lib/apps-client";
import { useWallet } from "../../lib/wallet-context";

export default function DevStudioPage() {
  const { walletAddress } = useWallet();
  const [allApps, setAllApps] = useState<AppData[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const loadApps = async () => {
    try {
      setAllApps(await fetchAllApps());
    } catch (error) {
      console.error("Error loading apps:", error);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const myApps = useMemo(
    () => (walletAddress ? allApps.filter((a) => a.publisher.toLowerCase() === walletAddress.toLowerCase()) : []),
    [allApps, walletAddress]
  );

  const handleUploadSubmitted = () => {
    setIsUploading(false);
    // Indexing happens async via the BlockchainListener poll loop - give it a moment before
    // refreshing, rather than assuming the new app is already in Postgres.
    setTimeout(loadApps, 4000);
  };

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="lg">
        Developer Studio
      </Title>

      {!walletAddress ? (
        <Alert color="yellow" title="Wallet not connected">
          Connect your wallet from the top bar to publish apps.
        </Alert>
      ) : isUploading ? (
        <UploadAppForm onCancel={() => setIsUploading(false)} onSubmit={handleUploadSubmitted} />
      ) : (
        <>
          <Group justify="flex-end" mb="lg">
            <Button onClick={() => setIsUploading(true)}>+ Upload App</Button>
          </Group>
          <AppList apps={myApps} hrefBase="/dev" emptyMessage="You haven't published any apps yet." />
        </>
      )}
    </Container>
  );
}
