import express, { Request, Response } from 'express'; // Import types
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Hardcoded list of apps
const APPS = [
  { id: "1", name: "CryptoChess", description: "Decentralized chess game.", category: "Games", rating: 4.8, version: "1.0.4" },
  { id: "2", name: "DeFiSwap", description: "Automated liquidity protocol.", category: "Finance", rating: 4.6, version: "2.1.0" },
];

// API Logic (Start)
app.post('/api/download', (req: Request, res: Response) => {
  const { appId } = req.body;
  console.log(`Backend: Starting download for ${appId}`);
  res.json({ status: "started" });
});

// API Logic (Status)
app.get('/api/status', (req: Request, res: Response) => {
  const appId = req.query.appId as string;
  res.json({ status: "in_progress", progress: 50 });
});

// New endpoint for the UI to fetch the store
app.get('/api/apps', (req: Request, res: Response) => {
  res.json(APPS);
});

const PORT = process.env.DESKTOP_API_PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));

