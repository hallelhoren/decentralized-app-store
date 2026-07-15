"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Container, Group, Menu, Text } from "@mantine/core";
import { useWallet } from "../lib/wallet-context";

const LINKS = [
  { href: "/store", label: "Store" },
  { href: "/dev", label: "Dev Studio" },
  { href: "/profile", label: "Profile" },
];

export default function TopNav() {
  const pathname = usePathname();
  const { walletAddress, isConnecting, connect, disconnect } = useWallet();

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <div style={{ borderBottom: "1px solid #e9ecef", backgroundColor: "white", position: "sticky", top: 0, zIndex: 100 }}>
      <Container size="lg" py="sm">
        <Group justify="space-between">
          <Group gap="xl">
            <Text component={Link} href="/store" fw={700} size="lg" c="dark" style={{ textDecoration: "none" }}>
              App Store
            </Text>
            <Group gap="xs">
              {LINKS.map((link) => (
                <Button
                  key={link.href}
                  component={Link}
                  href={link.href}
                  variant={pathname.startsWith(link.href) ? "light" : "subtle"}
                  color={pathname.startsWith(link.href) ? "brand" : "gray"}
                  size="sm"
                >
                  {link.label}
                </Button>
              ))}
            </Group>
          </Group>

          {walletAddress ? (
            <Menu shadow="md" width={180} position="bottom-end">
              <Menu.Target>
                <Button variant="light" size="sm" ff="monospace">
                  {shortAddress}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item color="red" onClick={disconnect}>
                  Disconnect
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Button onClick={connect} loading={isConnecting} size="sm">
              Connect Wallet
            </Button>
          )}
        </Group>
      </Container>
    </div>
  );
}
