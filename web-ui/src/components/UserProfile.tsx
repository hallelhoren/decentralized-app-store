"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, Group, Paper, Stack, Text, TextInput, Title } from "@mantine/core";

interface UserProfileProps {
  appCount: number;
  walletAddress: string | null;
  onConnectWallet: () => void;
  username: string | null;
  onSaveUsername: (username: string) => Promise<void>;
}

export default function UserProfile({
  appCount,
  walletAddress,
  onConnectWallet,
  username,
  onSaveUsername,
}: UserProfileProps) {
  const initials = walletAddress ? walletAddress.slice(2, 4).toUpperCase() : "?";
  const shortAddress = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null;

  const [usernameInput, setUsernameInput] = useState(username ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Keep the input in sync once the real value loads (it starts as null while the profile
  // fetch is still in flight) or after a successful save round-trips back through the parent.
  useEffect(() => {
    setUsernameInput(username ?? "");
  }, [username]);

  const handleSave = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      await onSaveUsername(trimmed);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Paper withBorder p="xl" radius="md" maw={480}>
      <Group mb="xl">
        <Avatar color="brand" radius="xl" size={64}>
          {initials}
        </Avatar>
        <div>
          {walletAddress ? (
            <>
              <Title order={4}>{username || shortAddress}</Title>
              <Text c="dimmed" size="sm" ff="monospace">
                {shortAddress}
              </Text>
            </>
          ) : (
            <Stack gap="xs">
              <Title order={4}>No wallet connected</Title>
              <Button onClick={onConnectWallet} size="xs" style={{ alignSelf: "flex-start" }}>
                Connect Wallet
              </Button>
            </Stack>
          )}
        </div>
      </Group>

      {walletAddress && (
        <Paper withBorder p="md" radius="md" bg="gray.0" mb="md">
          <Text size="sm" c="dimmed" mb={4}>
            Display name
          </Text>
          <Group align="flex-end">
            <TextInput
              placeholder="Choose a username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.currentTarget.value)}
              maxLength={32}
              style={{ flex: 1 }}
            />
            <Button
              onClick={handleSave}
              loading={isSaving}
              disabled={!usernameInput.trim() || usernameInput.trim() === username}
            >
              Save
            </Button>
          </Group>
        </Paper>
      )}

      <Paper withBorder p="md" radius="md" bg="gray.0">
        <Text size="sm" c="dimmed" mb={4}>
          Apps Published
        </Text>
        <Text fw={700} size="lg">
          {appCount}
        </Text>
      </Paper>
    </Paper>
  );
}
