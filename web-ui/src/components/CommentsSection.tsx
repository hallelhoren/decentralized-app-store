"use client";

import { useState } from "react";

// This component will handle the comments and reviews for each app. 
// It will allow users to leave comments and ratings, and developers to post updates or patch notes that are pinned at the top of the comments section.


export interface AppComment {
  id: string;
  text: string;
  rating?: number;
  isDeveloper: boolean;
  timestamp: number;
}

interface CommentsSectionProps {
  comments: AppComment[];
  onAddComment: (text: string, rating?: number) => void;
  isDeveloperMode: boolean;
}

export default function CommentsSection({ comments = [], onAddComment, isDeveloperMode }: CommentsSectionProps) {
  const [newComment, setNewComment] = useState("");
  const [rating, setRating] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    onAddComment(newComment, isDeveloperMode ? undefined : rating);
    setNewComment("");
    setRating(5);
  };

  // Sort comments: Developer comments always at the top, then newest first
  const sortedComments = [...comments].sort((a, b) => {
    if (a.isDeveloper && !b.isDeveloper) return -1;
    if (!a.isDeveloper && b.isDeveloper) return 1;
    return b.timestamp - a.timestamp;
  });

  return (
    <div style={{ marginTop: "40px", borderTop: "1px solid #334155", paddingTop: "24px" }}>
      <h3 style={{ color: "#f8fafc", marginBottom: "16px" }}>Comments & Reviews</h3>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} style={{ backgroundColor: "#0f172a", padding: "16px", borderRadius: "12px", marginBottom: "24px", border: "1px solid #1e293b" }}>
        <h4 style={{ margin: "0 0 12px 0", color: "#cbd5e1" }}>
          {isDeveloperMode ? "Post a Developer Update (Pinned)" : "Leave a Review"}
        </h4>
        
        {!isDeveloperMode && (
          <div style={{ marginBottom: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "14px" }}>Rating:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: star <= rating ? "#fbbf24" : "#475569", padding: 0 }}
              >
                ★
              </button>
            ))}
          </div>
        )}

        <textarea
          placeholder={isDeveloperMode ? "Share updates or patch notes with your users..." : "What do you think about this app?"}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          required
          rows={3}
          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#1e293b", color: "white", boxSizing: "border-box", marginBottom: "12px", resize: "vertical" }}
        />
        
        <button type="submit" style={{ padding: "10px 20px", borderRadius: "8px", border: "none", backgroundColor: isDeveloperMode ? "#f59e0b" : "#3b82f6", color: "white", fontWeight: "bold", cursor: "pointer" }}>
          {isDeveloperMode ? "Post Developer Update" : "Post Comment"}
        </button>
      </form>

      {/* Comments List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {sortedComments.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "14px" }}>No comments yet. Be the first!</p>
        ) : (
          sortedComments.map((comment) => (
            <div key={comment.id} style={{ backgroundColor: comment.isDeveloper ? "rgba(245, 158, 11, 0.05)" : "#1e293b", padding: "16px", borderRadius: "12px", border: comment.isDeveloper ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid #334155" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <div>
                  {comment.isDeveloper ? (
                    <span style={{ backgroundColor: "#f59e0b", color: "#fff", fontSize: "12px", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", marginRight: "8px" }}>
                      Developer
                    </span>
                  ) : (
                    <span style={{ color: "#f8fafc", fontWeight: "bold", marginRight: "8px" }}>User</span>
                  )}
                  {!comment.isDeveloper && comment.rating && (
                    <span style={{ color: "#fbbf24", fontSize: "14px" }}>
                      {"★".repeat(comment.rating)}{"☆".repeat(5 - comment.rating)}
                    </span>
                  )}
                </div>
                <span style={{ color: "#64748b", fontSize: "12px" }}>
                  {new Date(comment.timestamp).toLocaleDateString()}
                </span>
              </div>
              <p style={{ color: "#cbd5e1", margin: 0, fontSize: "15px", lineHeight: "1.5" }}>
                {comment.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}