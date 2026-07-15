"use client";

import { useState } from "react";
import { Badge, Button, Divider, Group, Paper, Rating, Stack, Text, Textarea, Title } from "@mantine/core";

export interface AppComment {
  id: string;
  text: string;
  rating?: number;
  isDeveloper: boolean;
  timestamp: number;
}

interface CommentsSectionProps {
  appId: string;
  comments: AppComment[];
  onReviewSubmitted: (text: string, rating?: number) => void;
  isDeveloperMode: boolean;
  reviewerAddress: string | null;
}

export default function CommentsSection({ appId, comments = [], onReviewSubmitted, isDeveloperMode, reviewerAddress }: CommentsSectionProps) {
  const [newComment, setNewComment] = useState("");
  const [rating, setRating] = useState(5);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!reviewerAddress) {
      alert("Connect your wallet before posting a review.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId,
          rating: isDeveloperMode ? undefined : rating,
          reviewText: newComment,
          isDeveloper: isDeveloperMode,
          reviewer: reviewerAddress,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || "Failed to submit review");
      }

      const submittedText = newComment;
      const submittedRating = isDeveloperMode ? undefined : rating;
      setNewComment("");
      setRating(5);
      onReviewSubmitted(submittedText, submittedRating);
    } catch (error) {
      console.error("Error submitting review:", error);
      const message = error instanceof Error ? error.message : "Failed to submit review.";
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  const sortedComments = [...comments].sort((a, b) => {
    if (a.isDeveloper && !b.isDeveloper) return -1;
    if (!a.isDeveloper && b.isDeveloper) return 1;
    return b.timestamp - a.timestamp;
  });

  return (
    <Stack mt="xl" pt="lg">
      <Divider />
      <Title order={4}>Comments & Reviews</Title>

      <Paper component="form" onSubmit={handleSubmit} withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={600} size="sm">
            {isDeveloperMode ? "Post a Developer Update (Pinned)" : "Leave a Review"}
          </Text>

          {!isDeveloperMode && <Rating value={rating} onChange={setRating} />}

          <Textarea
            placeholder={isDeveloperMode ? "Share updates or patch notes with your users..." : "What do you think about this app?"}
            value={newComment}
            onChange={(e) => setNewComment(e.currentTarget.value)}
            required
            minRows={3}
            autosize
          />

          <Group justify="flex-end">
            <Button type="submit" loading={isLoading} color={isDeveloperMode ? "orange" : "brand"}>
              {isDeveloperMode ? "Post Developer Update" : "Post Comment"}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Stack gap="sm">
        {sortedComments.length === 0 ? (
          <Text c="dimmed" size="sm">
            No comments yet. Be the first!
          </Text>
        ) : (
          sortedComments.map((comment) => (
            <Paper
              key={comment.id}
              withBorder
              p="md"
              radius="md"
              style={comment.isDeveloper ? { backgroundColor: "#fff8ec", borderColor: "#fbbf24" } : undefined}
            >
              <Group justify="space-between" mb={6}>
                <Group gap="xs">
                  {comment.isDeveloper ? (
                    <Badge color="orange">Developer</Badge>
                  ) : (
                    <Text fw={600} size="sm">
                      User
                    </Text>
                  )}
                  {!comment.isDeveloper && comment.rating && <Rating value={comment.rating} readOnly size="xs" />}
                </Group>
                <Text size="xs" c="dimmed">
                  {new Date(comment.timestamp).toLocaleDateString()}
                </Text>
              </Group>
              <Text size="sm">{comment.text}</Text>
            </Paper>
          ))
        )}
      </Stack>
    </Stack>
  );
}
