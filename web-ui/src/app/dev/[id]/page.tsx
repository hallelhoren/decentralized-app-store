"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Anchor, Badge, Button, Container, FileInput, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { AppData } from "../../../components/AppList";
import DownloadButton from "../../../components/DownloadButton";
import CommentsSection, { AppComment } from "../../../components/CommentsSection";
import { getEthereumContractWithSigner } from "../../../lib/blockchain";
import { fetchAllApps } from "../../../lib/apps-client";
import { useWallet } from "../../../lib/wallet-context";

const DESKTOP_API_URL = process.env.NEXT_PUBLIC_DESKTOP_API_URL || "http://localhost:3001";

export default function DevAppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { walletAddress } = useWallet();

  const [app, setApp] = useState<AppData | null>(null);
  const [comments, setComments] = useState<AppComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const loadApp = async () => {
    const apps = await fetchAllApps();
    setApp(apps.find((a) => a.id === id) ?? null);
    setLoading(false);
  };

  const loadComments = async () => {
    try {
      const response = await fetch(`/api/reviews?appId=${id}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.success && data.reviews) {
        setComments(
          data.reviews.map((r: any, index: number) => ({
            id: `${r.timestamp}_${index}`,
            text: r.reviewText,
            rating: r.rating,
            isDeveloper: r.isDeveloper || false,
            timestamp: r.timestamp,
          }))
        );
      }
    } catch (error) {
      console.error(`Failed to fetch reviews for app ${id}:`, error);
    }
  };

  useEffect(() => {
    loadApp();
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePublishVersion = async () => {
    if (!newVersionFile || !app) {
      alert("Select the updated binary to publish.");
      return;
    }

    setIsPublishing(true);
    try {
      setStatusMessage("Hashing and seeding file via desktop client...");
      const formData = new FormData();
      formData.append("file", newVersionFile);

      const uploadRes = await fetch(`${DESKTOP_API_URL}/api/upload`, { method: "POST", body: formData });
      if (!uploadRes.ok) {
        throw new Error(`Desktop client upload failed: ${await uploadRes.text()}`);
      }
      const { magnetLink, fileHash } = await uploadRes.json();

      setStatusMessage("Sending transaction to the blockchain...");
      const contract = await getEthereumContractWithSigner();
      const tx = await contract.publishNewVersion(app.id, magnetLink, "0x" + fileHash);
      await tx.wait();

      setShowUpdateForm(false);
      setNewVersionFile(null);
      setTimeout(loadApp, 4000);
    } catch (error: any) {
      console.error("Failed to publish new version:", error);
      alert("Failed to publish new version: " + (error.reason || error.message));
    } finally {
      setIsPublishing(false);
      setStatusMessage("");
    }
  };

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Loader />
      </Container>
    );
  }

  if (!app) {
    return (
      <Container size="md" py="xl">
        <Text>App not found.</Text>
        <Anchor onClick={() => router.push("/dev")}>Back to Developer Studio</Anchor>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Anchor component="button" onClick={() => router.push("/dev")} mb="lg" size="sm">
        ← Back to Developer Studio
      </Anchor>

      <Stack gap="md">
        <div>
          <Badge color="orange" variant="light" mb="xs">
            Your App
          </Badge>
          <Title order={2}>{app.name}</Title>
          <Text size="sm" c="dimmed">
            Current Version: {app.version}
          </Text>
        </div>

        <Text>{app.description}</Text>

        <Stack gap="sm" p="md" style={{ border: "1px dashed #3b82f6", borderRadius: 8 }}>
          <Text fw={600} c="brand" size="sm">
            Developer Actions
          </Text>
          <DownloadButton appId={app.id} />

          {!showUpdateForm ? (
            <Button variant="light" color="orange" onClick={() => setShowUpdateForm(true)}>
              Upload New Version
            </Button>
          ) : (
            <Stack gap="xs">
              <FileInput placeholder="Select updated binary" disabled={isPublishing} value={newVersionFile} onChange={setNewVersionFile} />
              {statusMessage && (
                <Text size="xs" c="brand">
                  {statusMessage}
                </Text>
              )}
              <Group gap="xs">
                <Button onClick={handlePublishVersion} loading={isPublishing} color="orange">
                  Save
                </Button>
                <Button variant="default" onClick={() => setShowUpdateForm(false)} disabled={isPublishing}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>

        <CommentsSection
          appId={app.id}
          comments={comments}
          onReviewSubmitted={loadComments}
          isDeveloperMode={true}
          reviewerAddress={walletAddress}
        />
      </Stack>
    </Container>
  );
}
