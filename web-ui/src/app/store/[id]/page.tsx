"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Anchor,
  Avatar,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  Spoiler,
  Stack,
  Tabs,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { AppData } from "../../../components/AppList";
import DownloadButton from "../../../components/DownloadButton";
import CommentsSection, { AppComment } from "../../../components/CommentsSection";
import ReportsList from "../../../components/ReportsList";
import RatingStars from "../../../components/RatingStars";
import VerifyBadge from "../../../components/VerifyBadge";
import { getEthereumSigner } from "../../../lib/blockchain";
import { fetchAllApps, formatPublisher } from "../../../lib/apps-client";
import { useWallet } from "../../../lib/wallet-context";
import { buildReportMessage } from "../../../lib/report-signing";

export default function StoreAppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { walletAddress } = useWallet();

  const [app, setApp] = useState<AppData | null>(null);
  const [comments, setComments] = useState<AppComment[]>([]);
  const [isReporting, setIsReporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0);

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

  const handleReportSubmit = async () => {
    const reason = reportReason.trim();
    if (!reason) return;

    setIsReporting(true);
    setReportError(null);
    try {
      // No transaction, no gas: the reporter just signs a plain message proving wallet
      // ownership over this exact (appId, reason) pair - the report itself is stored off-chain
      // and only gets anchored on-chain later, in a batch, by reports-aggregator.ts.
      const signer = await getEthereumSigner();
      const message = buildReportMessage(Number(id), reason);
      const signature = await signer.signMessage(message);

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: id, reason, signature }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          setReportError("A report has already been submitted from this account. You cannot report again.");
          return;
        }
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to submit report");
      }

      setIsReportModalOpen(false);
      setReportReason("");
      // Unlike the old on-chain flow, reportCount is updated synchronously by the API before
      // it responds - no indexing delay to wait out here.
      await loadApp();
      setReportsRefreshKey((k) => k + 1);
    } catch (error: any) {
      console.error("Failed to report app:", error);
      setReportError(error.reason || error.message || "Failed to submit report.");
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
        <Group align="flex-start" wrap="nowrap">
          <Avatar src={app.icon ?? undefined} radius="xl" size="xl">
            {app.name[0]?.toUpperCase()}
          </Avatar>
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
              <Text size="sm" c="dimmed">
                • ⬇ {app.downloadCount} download{app.downloadCount === 1 ? "" : "s"}
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
        </Group>

        <Text>{app.description}</Text>

        <Text size="xs" c="dimmed" ff="monospace">
          Publisher: {formatPublisher(app.publisher, app.publisherName)}
        </Text>

        {app.versions.length > 0 && (
          <Spoiler maxHeight={0} showLabel={`Version history (${app.versions.length})`} hideLabel="Hide">
            <Stack gap="sm">
              {app.versions.map((v) => (
                <div key={v.versionId}>
                  <Text size="xs" ff="monospace" c="dimmed">
                    v{v.versionId} — {new Date(v.publishedAt).toLocaleDateString()} — torrent: {v.torrentRef || "(none)"} — sha256: {v.sha256Digest}
                  </Text>
                  {v.releaseNotes && (
                    <Text size="sm" mt={2}>
                      {v.releaseNotes}
                    </Text>
                  )}
                </div>
              ))}
            </Stack>
          </Spoiler>
        )}

        <Group>
          <DownloadButton appId={app.id} />
          <Button
            variant="outline"
            color="red"
            onClick={() => {
              setReportError(null);
              setIsReportModalOpen(true);
            }}
          >
            🚩 Report app
          </Button>
        </Group>

        <Tabs defaultValue="reviews" mt="md">
          <Tabs.List>
            <Tabs.Tab value="reviews">Comments & Reviews</Tabs.Tab>
            <Tabs.Tab value="reports">Reports ({app.reportCount})</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="reviews" pt="md">
            <CommentsSection
              appId={app.id}
              comments={comments}
              onReviewSubmitted={loadComments}
              isDeveloperMode={false}
              reviewerAddress={walletAddress}
            />
          </Tabs.Panel>

          <Tabs.Panel value="reports" pt="md">
            <ReportsList key={reportsRefreshKey} appId={app.id} />
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <Modal
        opened={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setReportError(null);
        }}
        title="Report this app"
      >
        <Stack gap="sm">
          <Textarea
            placeholder="Why are you reporting this app? (e.g. malware, scam, broken)"
            value={reportReason}
            onChange={(e) => setReportReason(e.currentTarget.value)}
            minRows={3}
            autosize
            required
          />
          {reportError && (
            <Text size="sm" c="red">
              {reportError}
            </Text>
          )}
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setIsReportModalOpen(false);
                setReportError(null);
              }}
              disabled={isReporting}
            >
              Cancel
            </Button>
            <Button color="red" onClick={handleReportSubmit} loading={isReporting} disabled={!reportReason.trim()}>
              Submit Report
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
