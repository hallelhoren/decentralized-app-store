"use client";

import { Avatar, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";

interface UserProfileProps {
  appCount: number;
  walletAddress: string | null;
  onConnectWallet: () => void;
}

export default function UserProfile({ appCount, walletAddress, onConnectWallet }: UserProfileProps) {
  const initials = walletAddress ? walletAddress.slice(2, 4).toUpperCase() : "?";
  const shortAddress = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null;

  return (
    <Paper withBorder p="xl" radius="md" maw={480}>
      <Group mb="xl">
        <Avatar color="brand" radius="xl" size={64}>
          {initials}
        </Avatar>
        <div>
          {walletAddress ? (
            <>
              <Title order={4} ff="monospace">
                {shortAddress}
              </Title>
              <Text c="dimmed" size="sm">
                Connected wallet
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
