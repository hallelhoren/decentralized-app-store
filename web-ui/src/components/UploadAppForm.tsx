"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, FileInput, Group, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { getEthereumContractWithSigner } from "../lib/blockchain";
import { fetchAllApps, postWithRetryUntilIndexed } from "../lib/apps-client";
import { APP_CATEGORIES } from "../constants/categories";

interface UploadAppFormProps {
  onCancel: () => void;
  onSubmit: () => void;
}

const DESKTOP_API_URL = process.env.NEXT_PUBLIC_DESKTOP_API_URL || "http://localhost:3001";
const ALLOWED_ICON_TYPES = ["image/png", "image/jpeg"];
const MAX_ICON_BYTES = 2 * 1024 * 1024;

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function UploadAppForm({ onCancel, onSubmit }: UploadAppFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [icon, setIcon] = useState<File | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Object URLs must be created/revoked explicitly (unlike data: URIs) - doing this in an
  // effect keyed on `icon`, rather than inline in the render, means each preview URL is revoked
  // (and only ever one exists at a time) instead of leaking a new one on every re-render.
  useEffect(() => {
    if (!icon) {
      setIconPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(icon);
    setIconPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [icon]);

  const handleIconChange = (selected: File | null) => {
    if (selected) {
      if (!ALLOWED_ICON_TYPES.includes(selected.type)) {
        alert("App icon must be a PNG or JPEG image.");
        return;
      }
      if (selected.size > MAX_ICON_BYTES) {
        alert("App icon must be 2MB or smaller.");
        return;
      }
    }
    setIcon(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("Please select the application binary to publish.");
      return;
    }
    if (!category) {
      alert("Please select a category.");
      return;
    }

    setIsLoading(true);

    try {
      // The contract itself is the real enforcement (see DappStore.sol's isNameTaken check) -
      // this is just a cheap up-front check so a duplicate name fails immediately instead of
      // after the file's already been hashed/seeded and the wallet's already been prompted.
      setStatusMessage("Checking name availability...");
      const existingApps = await fetchAllApps();
      if (existingApps.some((a) => a.name === name)) {
        alert(`"${name}" is already taken. Choose a different name.`);
        setIsLoading(false);
        setStatusMessage("");
        return;
      }

      // 1. Hand the real file to the desktop client: it hashes it (SHA-256) and starts
      // seeding it over BitTorrent, returning the magnet link + hash to anchor on-chain.
      setStatusMessage("Hashing and seeding file via desktop client...");
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(`${DESKTOP_API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        throw new Error(`Desktop client upload failed: ${await uploadRes.text()}`);
      }
      const { magnetLink, fileHash } = await uploadRes.json();

      setStatusMessage("Waiting for wallet...");
      const contract = await getEthereumContractWithSigner();

      // The contract still just takes a string[] of tags, unchanged - the predefined-category
      // restriction is enforced here at the UI level (the Select below), not on-chain, so this
      // is still exactly the shape publishApp already expects.
      const tagsArray = [category];

      const shaDigestBytes32 = "0x" + fileHash;

      setStatusMessage("Sending transaction to the blockchain...");
      const tx = await contract.publishApp(name, description, tagsArray, magnetLink, shaDigestBytes32);
      const receipt = await tx.wait();

      // The app itself is already successfully published on-chain at this point - the icon is
      // a best-effort extra, so a failure attaching it must never surface as "publish failed".
      if (icon) {
        try {
          // The new appId is only assigned once the transaction mines - parsed straight out of
          // the receipt's own AppPublished log rather than waiting on BlockchainListener's
          // polling to index it first, since we need it right now to attach the icon.
          const publishedEvent = receipt.logs
            .map((log: any) => {
              try {
                return contract.interface.parseLog(log);
              } catch {
                return null;
              }
            })
            .find((parsed: any) => parsed?.name === "AppPublished");

          if (publishedEvent) {
            setStatusMessage("Uploading app icon...");
            const iconDataUri = await fileToDataUri(icon);
            await postWithRetryUntilIndexed(`/api/apps/${Number(publishedEvent.args.appId)}/icon`, {
              icon: iconDataUri,
            });
          }
        } catch (iconError) {
          console.error("App published, but uploading its icon failed:", iconError);
        }
      }

      onSubmit();
    } catch (error: any) {
      console.error("Publish failed:", error);
      alert("Failed to publish app: " + (error.reason || error.message));
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  return (
    <Paper withBorder p="xl" radius="md" maw={480}>
      <Title order={3} mb="md">
        Upload New dApp
      </Title>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput placeholder="App Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required disabled={isLoading} />
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} required minRows={4} disabled={isLoading} />
          <Select
            label="Category"
            placeholder="Select a category"
            data={[...APP_CATEGORIES]}
            value={category}
            onChange={setCategory}
            required
            disabled={isLoading}
          />
          <FileInput label="Application binary" placeholder="Select file" required disabled={isLoading} value={file} onChange={setFile} />

          <Group align="flex-end">
            <FileInput
              label="App icon (optional)"
              placeholder="PNG or JPEG, up to 2MB"
              accept="image/png,image/jpeg"
              disabled={isLoading}
              value={icon}
              onChange={handleIconChange}
              style={{ flex: 1 }}
            />
            <Avatar src={iconPreviewUrl ?? undefined} radius="xl" size="lg">
              {name ? name[0].toUpperCase() : "?"}
            </Avatar>
          </Group>

          {statusMessage && (
            <Text size="sm" c="brand">
              {statusMessage}
            </Text>
          )}

          <Group mt="sm">
            <Button type="submit" loading={isLoading} flex={1}>
              Publish to Blockchain
            </Button>
            <Button type="button" variant="default" onClick={onCancel} disabled={isLoading} flex={1}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
