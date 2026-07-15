"use client";

import { useState } from "react";
import { Button, FileInput, Group, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { getEthereumContractWithSigner } from "../lib/blockchain";
import { fetchAllApps } from "../lib/apps-client";
import { APP_CATEGORIES } from "../constants/categories";

interface UploadAppFormProps {
  onCancel: () => void;
  onSubmit: () => void;
}

const DESKTOP_API_URL = process.env.NEXT_PUBLIC_DESKTOP_API_URL || "http://localhost:3001";

export default function UploadAppForm({ onCancel, onSubmit }: UploadAppFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

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
      await tx.wait();

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
