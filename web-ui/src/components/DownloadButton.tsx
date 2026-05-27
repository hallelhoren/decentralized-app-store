"use client";
import { useState } from "react";




export default function DownloadButton({ appId }: { appId: string }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'in_progress' | 'finished'>('idle');

  const startDownload = async () => {
    // 1. Check if appId exists before doing anything
    if (!appId) {
      console.error("DownloadButton: appId is missing!");
      return;
    }

    setStatus('in_progress');
    
    // 2. Pass the appId in the body
    await fetch("/api/download", { 
      method: "POST", 
      body: JSON.stringify({ appId }), 
      headers: { "Content-Type": "application/json" }
    });
    
    const interval = setInterval(async () => {
      // 3. Pass the appId in the query string
      const res = await fetch(`/api/status?appId=${encodeURIComponent(appId)}`);
      const data = await res.json();

      console.log("Frontend received:", data); // Check if this logs numbers > 0
      
      setProgress(data.progress);
      
      if (data.status === 'finished'|| data.progress >= 100) {
        setStatus('finished');
        clearInterval(interval);
        console.log(`Polling stopped for ${appId}`);
      }
    }, 1000);
  };

  return (
    <div className="w-64">
      {status === 'idle' && (
        <button 
          onClick={startDownload}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
        >
          Download App
        </button>
      )}

      {status === 'in_progress' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium text-gray-700">
            <span>Downloading...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {status === 'finished' && (
        <div className="w-full bg-green-100 text-green-800 text-center font-bold py-3 px-6 rounded-lg border border-green-200">
          ✓ Installed
        </div>
      )}
    </div>
  );
}