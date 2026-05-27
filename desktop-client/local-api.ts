import express, { Request, Response } from 'express'; // Import types
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = process.env.DESKTOP_API_PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));