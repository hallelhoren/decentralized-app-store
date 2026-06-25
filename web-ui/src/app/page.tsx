"use client";
import { ethers } from "ethers";
import ContractABI from "../../../contracts/artifacts/contracts/DappStore.sol/DecentralizedAppStore.json";
import { useEffect, useState } from "react";
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
  const [allApps, setAllApps] = useState<AppData[]>(INITIAL_STORE_APPS);
  const [myApps, setMyApps] = useState<AppData[]>([]);
  const [storeSelectedApp, setStoreSelectedApp] = useState<AppData | null>(null);
  const [devSelectedApp, setDevSelectedApp] = useState<AppData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [commentsMap, setCommentsMap] = useState<Record<string, AppComment[]>>({});

  // Recalculate rating whenever comments change
  const getUpdatedRating = (appId: string, currentRating: number, newComments: AppComment[]): number => {
    const userReviews = newComments.filter(c => !c.isDeveloper && c.rating !== undefined);
    if (userReviews.length === 0) return 0;
    const sum = userReviews.reduce((acc, c) => acc + (c.rating || 0), 0);
    return Number((sum / userReviews.length).toFixed(1));
  };

 // Safe fetch function with crash prevention
  const fetchReviewsForApp = async (appId: string) => {
    try {
      const response = await fetch(`/api/reviews?appId=${appId}`);
      
      if (!response.ok) {
        console.error("Server error or route not found:", response.status);
        return;
      }

      const text = await response.text();
      if (!text) return;

      const data = JSON.parse(text);

      if (data.success && data.reviews) {
        const formattedComments: AppComment[] = data.reviews.map((r: any, index: number) => ({
          id: `${r.timestamp}_${index}`,
          text: r.reviewText,
          rating: r.rating,
          isDeveloper: r.isDeveloper || false,
          timestamp: r.timestamp,
        }));
        
        setCommentsMap(prev => ({
          ...prev,
          [appId]: formattedComments
        }));

        const newRating = getUpdatedRating(appId, 0, formattedComments);

        setAllApps(apps => 
          apps.map(a => a.id === appId ? { ...a, rating: newRating } : a)
        );

        setMyApps(apps => 
          apps.map(a => a.id === appId ? { ...a, rating: newRating } : a)
        );
      }
    } catch (error) {
      console.error(`Failed to fetch reviews for app ${appId}:`, error);
    }
  };

  useEffect(() => {
    if (storeSelectedApp) {
      fetchReviewsForApp(storeSelectedApp.id);
    }
  }, [storeSelectedApp]);

  // טעינת ביקורות ברגע שנבחרת אפליקציה באזור המפתחים
  useEffect(() => {
    if (devSelectedApp) {
      fetchReviewsForApp(devSelectedApp.id);
    }
  }, [devSelectedApp]);
  

  const handleUploadApp = (newApp: AppData) => {
    setMyApps([...myApps, newApp]);
    setAllApps([...allApps, newApp,]);
    setIsUploading(false);
  };

  const loadAppsFromBlockchain = async () => {
  try {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
    const contract = new ethers.Contract(contractAddress, ContractABI.abi, provider);

    const filter = contract.filters.AppPublished();
    const events = await contract.queryFilter(filter);

    const blockchainApps: AppData[] = events.map((event: any) => ({
      id: event.args.appId.toString(),
      name: event.args.name,
      description: "App from Blockchain", 
      category: "General",
      rating: commentsMap[event.args.appId.toString()] ? getUpdatedRating(event.args.appId.toString(), 0, commentsMap[event.args.appId.toString()]) : 0,
      version: "1.0.0",
      contractAddress: event.args.publisher
    }));

    setAllApps(blockchainApps);
  } catch (error) {
    console.error("Error loading apps:", error);
  }
};

  useEffect(() => {
  loadAppsFromBlockchain();
  }, []);

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
            <AppDetails 
              app={storeSelectedApp} 
              onBack={() => setStoreSelectedApp(null)} 
              comments={commentsMap[storeSelectedApp.id] || []} 
              onReviewSubmitted={() => fetchReviewsForApp(storeSelectedApp.id)} 
            />
          ) : (
            <>
              <SearchBar onSearch={setSearchTerm} />
              <AppList apps={filteredApps} onSelectApp={setStoreSelectedApp} />
            </>
          )
        )}

        {activeTab === "dev" && (
          isUploading ? <UploadAppForm onCancel={() => setIsUploading(false)} onSubmit={handleUploadApp} /> :
          devSelectedApp ? (
            <DeveloperAppDetails 
              app={devSelectedApp} 
              onBack={() => setDevSelectedApp(null)} 
              onUpdateVersion={(id, v) => setMyApps(prev => prev.map(a => a.id === id ? {...a, version: v} : a))} 
              comments={commentsMap[devSelectedApp.id] || []} 
              onReviewSubmitted={() => fetchReviewsForApp(devSelectedApp.id)} 
            />
          ) : (
          <div>
            <button onClick={() => setIsUploading(true)} style={{ marginBottom: "24px", padding: "10px 20px", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>+ Upload App</button>
            <AppList apps={myApps} onSelectApp={setDevSelectedApp} />
          </div>
          )
        )}
      </main>
    </div>
  );
}