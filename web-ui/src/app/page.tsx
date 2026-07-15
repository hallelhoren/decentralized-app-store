"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppList, { AppData } from "../components/AppList";
import AppDetails from "../components/AppDetails";
import UserProfile from "../components/UserProfile";
import UploadAppForm from "../components/UploadAppForm";
import DeveloperAppDetails from "../components/DeveloperAppDetails";
import SearchBar, { SearchFilters } from "../components/SearchBar";
import { AppComment } from "../components/CommentsSection";
import { connectWallet, getAlreadyConnectedAccount } from "../lib/blockchain";

interface ApiApp {
  id: number;
  publisher: string;
  name: string;
  description: string;
  tags: string[];
  latestVersionId: number;
  averageRating: number;
  ratingCount: number;
  reportCount: number;
  versions: { versionId: number; torrentRef: string; sha256Digest: string; publishedAt: string }[];
}

function toAppData(app: ApiApp): AppData {
  return {
    id: String(app.id),
    name: app.name,
    description: app.description,
    category: app.tags[0] || "General",
    tags: app.tags,
    rating: Number(app.averageRating.toFixed(1)),
    ratingCount: app.ratingCount,
    reportCount: app.reportCount,
    version: String(app.latestVersionId),
    publisher: app.publisher,
    versions: app.versions,
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"profile" | "store" | "dev">("profile");

  const [allApps, setAllApps] = useState<AppData[]>([]);
  const [storeSelectedApp, setStoreSelectedApp] = useState<AppData | null>(null);
  const [devSelectedApp, setDevSelectedApp] = useState<AppData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ search: "", category: "", minRating: 0 });
  const [commentsMap, setCommentsMap] = useState<Record<string, AppComment[]>>({});
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const handleConnectWallet = useCallback(async () => {
    try {
      const address = await connectWallet();
      setWalletAddress(address);
    } catch (error: any) {
      console.error("Failed to connect wallet:", error);
      alert(error.message || "Failed to connect wallet");
    }
  }, []);

  // Silently pick up a wallet the user already approved in a previous visit (eth_accounts
  // never prompts). Without this, the Dev tab's Upload button - gated on walletAddress being
  // set - stays hidden behind a "connect your wallet" message on every single page load, even
  // for a user who already connected, making the whole upload feature look like it's missing.
  useEffect(() => {
    getAlreadyConnectedAccount().then((address) => {
      if (address) setWalletAddress(address);
    });
  }, []);

  // Search/browse now hits the Postgres-backed cache (GET /api/apps) instead of scanning the
  // chain client-side - the cache is what the BlockchainListener (src/lib/blockchain-listener.ts)
  // keeps in sync server-side.
  const loadApps = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.category) params.set("category", filters.category);
      if (filters.minRating) params.set("minRating", String(filters.minRating));

      const res = await fetch(`/api/apps?${params.toString()}`);
      if (!res.ok) throw new Error(`GET /api/apps failed: ${res.status}`);
      const data = await res.json();
      setAllApps((data.apps as ApiApp[]).map(toAppData));
    } catch (error) {
      console.error("Error loading apps:", error);
    }
  }, [filters]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const fetchReviewsForApp = async (appId: string) => {
    try {
      const response = await fetch(`/api/reviews?appId=${appId}`);
      if (!response.ok) {
        console.error("Server error or route not found:", response.status);
        return;
      }

      const data = await response.json();
      if (data.success && data.reviews) {
        const formattedComments: AppComment[] = data.reviews.map((r: any, index: number) => ({
          id: `${r.timestamp}_${index}`,
          text: r.reviewText,
          rating: r.rating,
          isDeveloper: r.isDeveloper || false,
          timestamp: r.timestamp,
        }));

        setCommentsMap((prev) => ({ ...prev, [appId]: formattedComments }));
      }
    } catch (error) {
      console.error(`Failed to fetch reviews for app ${appId}:`, error);
    }
  };

  useEffect(() => {
    if (storeSelectedApp) fetchReviewsForApp(storeSelectedApp.id);
  }, [storeSelectedApp]);

  useEffect(() => {
    if (devSelectedApp) fetchReviewsForApp(devSelectedApp.id);
  }, [devSelectedApp]);

  const handleUploadSubmitted = () => {
    setIsUploading(false);
    // Indexing happens async via the BlockchainListener poll loop - give it a moment before
    // refreshing, rather than assuming the new app is already in Postgres.
    setTimeout(loadApps, 4000);
  };

  const handleVersionPublished = () => {
    setTimeout(loadApps, 4000);
  };

  const myApps = useMemo(
    () => (walletAddress ? allApps.filter((a) => a.publisher.toLowerCase() === walletAddress.toLowerCase()) : []),
    [allApps, walletAddress]
  );

  const categories = useMemo(
    () => Array.from(new Set(allApps.map((a) => a.category))).sort(),
    [allApps]
  );

  return (
    <div style={{ backgroundColor: "#0f172a", minHeight: "100vh", color: "#f8fafc", padding: "0 24px 60px 24px" }}>
      <header style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 0", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between" }}>
        <h1>Decentralized App Store</h1>
        <nav style={{ display: "flex", gap: "16px" }}>
          {["profile", "store", "dev"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} style={{ background: "none", border: "none", color: activeTab === tab ? "#3b82f6" : "#94a3b8", fontWeight: "bold", cursor: "pointer" }}>
              {tab.toUpperCase()}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: "1200px", margin: "40px auto" }}>
        {activeTab === "profile" && (
          <UserProfile appCount={myApps.length} walletAddress={walletAddress} onConnectWallet={handleConnectWallet} />
        )}

        {activeTab === "store" && (
          storeSelectedApp ? (
            <AppDetails
              app={storeSelectedApp}
              onBack={() => setStoreSelectedApp(null)}
              comments={commentsMap[storeSelectedApp.id] || []}
              onReviewSubmitted={() => fetchReviewsForApp(storeSelectedApp.id)}
              reviewerAddress={walletAddress}
            />
          ) : (
            <>
              <SearchBar filters={filters} categories={categories} onChange={setFilters} />
              <AppList apps={allApps} onSelectApp={setStoreSelectedApp} />
            </>
          )
        )}

        {activeTab === "dev" && (
          isUploading ? (
            <UploadAppForm onCancel={() => setIsUploading(false)} onSubmit={handleUploadSubmitted} />
          ) : devSelectedApp ? (
            <DeveloperAppDetails
              app={devSelectedApp}
              onBack={() => setDevSelectedApp(null)}
              onVersionPublished={handleVersionPublished}
              comments={commentsMap[devSelectedApp.id] || []}
              onReviewSubmitted={() => fetchReviewsForApp(devSelectedApp.id)}
              reviewerAddress={walletAddress}
            />
          ) : (
            <div>
              {!walletAddress ? (
                <p style={{ color: "#94a3b8" }}>Connect your wallet from the Profile tab to publish apps.</p>
              ) : (
                <button onClick={() => setIsUploading(true)} style={{ marginBottom: "24px", padding: "10px 20px", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>+ Upload App</button>
              )}
              <AppList apps={myApps} onSelectApp={setDevSelectedApp} />
            </div>
          )
        )}
      </main>
    </div>
  );
}
