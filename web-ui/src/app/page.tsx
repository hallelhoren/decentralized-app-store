"use client";

import { useState, useEffect } from "react";
import AppList, { AppData } from "../components/AppList";
import AppDetails from "../components/AppDetails";
import UserProfile from "../components/UserProfile";
import UploadAppForm from "../components/UploadAppForm";
import DeveloperAppDetails from "../components/DeveloperAppDetails";
import SearchBar from "../components/SearchBar";
import { AppComment } from "../components/CommentsSection";

const INITIAL_STORE_APPS: AppData[] = [
  { id: "1", name: "CryptoChess", description: "Decentralized chess game.", category: "Games", rating: 4.8, version: "1.0.4", contractAddress: "0x71C7...476B" },
  { id: "2", name: "DeFiSwap", description: "Automated liquidity protocol.", category: "Finance", rating: 4.6, version: "2.1.0", contractAddress: "0xE592...564" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"profile" | "store" | "dev">("profile");
  
  // States
  const [allApps, setAllApps] = useState([]);
  const [myApps, setMyApps] = useState<AppData[]>([]);
  const [storeSelectedApp, setStoreSelectedApp] = useState<AppData | null>(null);
  const [devSelectedApp, setDevSelectedApp] = useState<AppData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [commentsMap, setCommentsMap] = useState<Record<string, AppComment[]>>({});
  
  
  useEffect(() => {
    // Fetch apps from the backend instead of using the hardcoded constant
    fetch('/api/apps')
      .then(res => res.json())
      .then(data => setAllApps(data))
      .catch(err => console.error("Failed to fetch apps:", err));
  }, []);

  // Recalculate rating whenever comments change
  const getUpdatedRating = (appId: string, currentRating: number, newComments: AppComment[]): number => {
    const userReviews = newComments.filter(c => !c.isDeveloper && c.rating !== undefined);
    if (userReviews.length === 0) return 0;
    const sum = userReviews.reduce((acc, c) => acc + (c.rating || 0), 0);
    return Number((sum / userReviews.length).toFixed(1));
  };

  const handleAddComment = (appId: string, text: string, rating: number = 0, isDeveloper: boolean = false) => {
    const newComment: AppComment = { id: Date.now().toString(), text, rating: isDeveloper ? undefined : rating, isDeveloper, timestamp: Date.now() };
    
    setCommentsMap(prev => {
      const updatedComments = [...(prev[appId] || []), newComment];
      
      // Update rating in allApps
      setAllApps(apps => apps.map(a => a.id === appId ? { ...a, rating: getUpdatedRating(appId, a.rating, updatedComments) } : a));
      // Update rating in myApps if applicable
      setMyApps(apps => apps.map(a => a.id === appId ? { ...a, rating: getUpdatedRating(appId, a.rating, updatedComments) } : a));
      
      return { ...prev, [appId]: updatedComments };
    });
  };

  const handleUploadApp = (newApp: AppData) => {
    setMyApps([...myApps, newApp]);
    setAllApps([...allApps, newApp]);
    setIsUploading(false);
  };

  const filteredApps = allApps.filter(app => app.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ backgroundColor: "#0f172a", minHeight: "100vh", color: "#f8fafc", padding: "0 24px 60px 24px" }}>
      <header style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 0", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between" }}>
        <h1>Decentralized App Store</h1>
        <nav style={{ display: "flex", gap: "16px" }}>
          {["profile", "store", "dev"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} style={{ background: "none", border: "none", color: activeTab === tab ? "#3b82f6" : "#94a3b8", fontWeight: "bold", cursor: "pointer" }}>
              {tab.toUpperCase()}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: "1200px", margin: "40px auto" }}>
        {activeTab === "profile" && <UserProfile appCount={myApps.length} />}
        
        {activeTab === "store" && (
          storeSelectedApp ? (
            <AppDetails app={storeSelectedApp} onBack={() => setStoreSelectedApp(null)} comments={commentsMap[storeSelectedApp.id] || []} onAddComment={(t, r) => handleAddComment(storeSelectedApp.id, t, r, false)} />
          ) : (
            <>
              <SearchBar onSearch={setSearchTerm} />
              <AppList apps={filteredApps} onSelectApp={setStoreSelectedApp} />
            </>
          )
        )}

        {activeTab === "dev" && (
          isUploading ? <UploadAppForm onCancel={() => setIsUploading(false)} onSubmit={handleUploadApp} /> :
          devSelectedApp ? <DeveloperAppDetails app={devSelectedApp} onBack={() => setDevSelectedApp(null)} onUpdateVersion={(id, v) => setMyApps(prev => prev.map(a => a.id === id ? {...a, version: v} : a))} comments={commentsMap[devSelectedApp.id] || []} onAddComment={(t) => handleAddComment(devSelectedApp.id, t, 0, true)} /> :
          <div>
            <button onClick={() => setIsUploading(true)} style={{ marginBottom: "24px", padding: "10px 20px", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>+ Upload App</button>
            <AppList apps={myApps} onSelectApp={setDevSelectedApp} />
          </div>
        )}
      </main>
    </div>
  );
}