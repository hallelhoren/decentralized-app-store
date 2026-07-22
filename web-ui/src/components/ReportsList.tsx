"use client";

import { useEffect, useState } from "react";
import { Group, Paper, Stack, Text } from "@mantine/core";

interface AppReport {
  id: string;
  reporter: string;
  reason: string;
  timestamp: number;
}

interface ReportsListProps {
  appId: string;
}

export default function ReportsList({ appId }: ReportsListProps) {
  const [reports, setReports] = useState<AppReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?appId=${appId}`)
      .then((res) => res.json())
      .then((data) => setReports(data.reports ?? []))
      .catch((error) => console.error(`Failed to fetch reports for app ${appId}:`, error))
      .finally(() => setLoading(false));
  }, [appId]);

  if (loading) {
    return (
      <Text c="dimmed" size="sm">
        Loading reports...
      </Text>
    );
  }

  if (reports.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No reports filed for this app.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {reports.map((report) => (
        <Paper key={report.id} withBorder p="md" radius="md" style={{ borderColor: "#fca5a5" }}>
          <Group justify="space-between" mb={6}>
            <Text size="xs" ff="monospace" c="dimmed">
              {report.reporter.slice(0, 6)}...{report.reporter.slice(-4)}
            </Text>
            <Text size="xs" c="dimmed">
              {new Date(report.timestamp).toLocaleDateString()}
            </Text>
          </Group>
          <Text size="sm">{report.reason}</Text>
        </Paper>
      ))}
    </Stack>
  );
}
