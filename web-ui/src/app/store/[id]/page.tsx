"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Anchor, Badge, Button, Container, Group, Loader, Spoiler, Stack, Text, Title } from "@mantine/core";
import { AppData } from "../../../components/AppList";
import DownloadButton from "../../../components/DownloadButton";
import CommentsSection, { AppComment } from "../../../components/CommentsSection";
import RatingStars from "../../../components/RatingStars";
import VerifyBadge from "../../../components/VerifyBadge";
import { getEthereumContractWithSigner } from "../../../lib/blockchain";
import { fetchAllApps } from "../../../lib/apps-client";
import { useWallet } from "../../../lib/wallet-context";

export default function StoreAppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { walletAddress } = useWallet();

  const [app, setApp] = useState<AppData | null>(null);
  const [comments, setComments] = useState<AppComment[]>([]);
  const [isReporting, setIsReporting] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handleReport = async () => {
    const reason = window.prompt("Why are you reporting this app? (e.g. malware, scam, broken)");
    if (!reason) return;

    setIsReporting(true);
    try {
      const contract = await getEthereumContractWithSigner();
      const tx = await contract.reportApp(id, reason);
      await tx.wait();
      alert("Report submitted on-chain. Thank you.");
    } catch (error: any) {
      console.error("Failed to report app:", error);
      alert("Failed to submit report: " + (error.reason || error.message));
    } finally {
      setIsReporting(false);
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
        <Anchor onClick={() => router.push("/store")}>Back to Store</Anchor>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Anchor component="button" onClick={() => router.push("/store")} mb="lg" size="sm">
        ← Back to Store
      </Anchor>

      <Stack gap="md">
        <div>
          <Badge variant="light" color="brand" mb="xs">
            {app.category}
          </Badge>
          <Title order={2}>{app.name}</Title>
          <Group gap="xs" mt={4}>
            <RatingStars value={app.rating} count={app.ratingCount} />
            <Text size="sm" c="dimmed">
              • Version {app.version}
            </Text>
            {app.reportCount > 0 && (
              <Text size="sm" c="orange">
                • ⚠ {app.reportCount} report{app.reportCount === 1 ? "" : "s"}
              </Text>
            )}
          </Group>
          <Group mt="xs">
            <VerifyBadge appId={app.id} />
          </Group>
        </div>

        <Text>{app.description}</Text>

        <Text size="xs" c="dimmed" ff="monospace">
          Publisher: {app.publisher}
        </Text>

        {app.versions.length > 0 && (
          <Spoiler maxHeight={0} showLabel={`Version history (${app.versions.length})`} hideLabel="Hide">
            <Stack gap="xs">
              {app.versions.map((v) => (
                <Text key={v.versionId} size="xs" ff="monospace" c="dimmed">
                  v{v.versionId} — {new Date(v.publishedAt).toLocaleDateString()} — torrent: {v.torrentRef || "(none)"} — sha256: {v.sha256Digest}
                </Text>
              ))}
            </Stack>
          </Spoiler>
        )}

        <Group>
          <DownloadButton appId={app.id} />
          <Button variant="outline" color="red" onClick={handleReport} loading={isReporting}>
            🚩 Report app
          </Button>
        </Group>

        <CommentsSection
          appId={app.id}
          comments={comments}
          onReviewSubmitted={loadComments}
          isDeveloperMode={false}
          reviewerAddress={walletAddress}
        />
      </Stack>
    </Container>
  );
}
