import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import BitTorrentManager from './BitTorrentManager';
import HashVerifier from './HashVerifier';

const app = express();
app.use(cors());
app.use(express.json());

const btManager = new BitTorrentManager();
let btInitialized = false;

// Where downloaded apps land, keyed by appId: ~/decentralized-apps/<appId>/
const APPS_DIR = path.join(os.homedir(), 'decentralized-apps');
// Where files a developer is publishing get parked so this process can keep seeding them.
const UPLOADS_DIR = path.join(APPS_DIR, '_uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
});

interface DownloadState {
  appId: string;
  torrentId: string;
  savePath: string;
  expectedHash?: string;
  // null = nothing to verify yet (still downloading, or caller supplied no expected hash)
  verified: boolean | null;
}

// Web UI / Next.js cache server only ever needs to think in terms of appId, not torrent
// info-hashes - this map is what makes that possible.
const downloadsByAppId = new Map<string, DownloadState>();

// Start (or resume polling) a download. The expected on-chain SHA-256 digest is supplied by
// the caller (the Next.js cache server, which reads it from its indexed DB) so this process
// never needs its own blockchain RPC connection just to verify a file.
app.post('/api/download', async (req: Request, res: Response) => {
  try {
    const { appId, magnetLink, expectedHash } = req.body ?? {};

    if (!appId || !magnetLink) {
      return res.status(400).json({ error: 'appId and magnetLink are required' });
    }
    if (!btInitialized) {
      return res.status(503).json({ error: 'BitTorrent client not ready yet' });
    }

    const existing = downloadsByAppId.get(appId);
    if (existing) {
      return res.json({ status: 'started', appId, torrentId: existing.torrentId, savePath: existing.savePath });
    }

    const savePath = path.join(APPS_DIR, appId);

    // Registered *before* the download starts, and mutated in place afterwards: a torrent
    // that's already fully cached in this process (e.g. it's also being seeded here) can
    // complete synchronously, inside client.add()'s own callback - i.e. before
    // btManager.downloadFile()'s promise even resolves. If this bookkeeping entry were only
    // added after that await, the completion callback below would look it up, find nothing,
    // and silently skip verification.
    const state: DownloadState = { appId, torrentId: '', savePath, expectedHash, verified: null };
    downloadsByAppId.set(appId, state);

    const torrentId = await btManager.downloadFile(magnetLink, savePath, async (filePaths) => {
      if (expectedHash && filePaths.length > 0) {
        try {
          state.verified = await HashVerifier.verifyFileHash(filePaths[0], expectedHash);
          console.log(`[${appId}] hash verification ${state.verified ? 'PASSED' : 'FAILED'}`);
        } catch (err) {
          console.error(`[${appId}] hash verification error:`, err);
          state.verified = false;
        }
      }
    });

    state.torrentId = torrentId;

    res.json({ status: 'started', appId, torrentId, savePath });
  } catch (error) {
    console.error('Download endpoint error:', error);
    res.status(500).json({ error: 'Failed to start download', details: String(error) });
  }
});

app.get('/api/status', (req: Request, res: Response) => {
  const appId = req.query.appId as string;
  if (!appId) {
    return res.status(400).json({ error: 'appId is required' });
  }

  const state = downloadsByAppId.get(appId);
  if (!state) {
    return res.json({ status: 'idle', progress: 0, verified: null });
  }

  const progress = btManager.getProgress(state.torrentId);
  if (!progress) {
    return res.json({ status: 'idle', progress: 0, verified: null });
  }

  const status = progress.progress >= 100 ? 'finished' : 'in_progress';
  res.json({
    status,
    progress: Math.round(progress.progress * 100) / 100,
    speed: progress.speed,
    eta: progress.eta,
    downloaded: progress.downloaded,
    total: progress.total,
    // Only meaningful once the download is finished; while in progress it's always null.
    verified: status === 'finished' ? state.verified : null,
  });
});

// Developer publish flow: the web UI streams the selected binary here as multipart form
// data (browsers can't hand over a real filesystem path), we hash it and start seeding it,
// and return the magnet link + hash so the web UI can submit them on-chain.
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'file is required (multipart/form-data field "file")' });
    }
    if (!btInitialized) {
      return res.status(503).json({ error: 'BitTorrent client not ready yet' });
    }

    const fileHash = await HashVerifier.calculateFileHash(file.path);
    const magnetLink = await btManager.seedFile(file.path);

    res.status(201).json({ magnetLink, fileHash });
  } catch (error) {
    console.error('Upload endpoint error:', error);
    res.status(500).json({ error: 'Failed to upload and seed app', details: String(error) });
  }
});

const PORT = process.env.DESKTOP_API_PORT || 3001;

// Seeding lives entirely in this process's memory - restarting it (which happens often during
// local dev) silently stops seeding every previously-published file, leaving on-chain torrent
// refs pointing at nothing. Re-seeding everything already sitting in UPLOADS_DIR on startup
// fixes that: WebTorrent derives the same infoHash for the same file content deterministically,
// so this reproduces the exact magnet link that was already anchored on-chain, not a new one.
async function reseedExistingUploads() {
  const files = await fs.promises.readdir(UPLOADS_DIR).catch(() => [] as string[]);
  for (const filename of files) {
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
      const magnetLink = await btManager.seedFile(filePath);
      console.log(`[reseed] resumed seeding ${filename}: ${magnetLink}`);
    } catch (error) {
      console.error(`[reseed] failed to reseed ${filename}:`, error);
    }
  }
}

const server = app.listen(PORT, async () => {
  console.log(`Desktop client API running on ${PORT}`);
  try {
    await btManager.initialize();
    btInitialized = true;
    console.log('BitTorrent manager initialized successfully');
    await reseedExistingUploads();
  } catch (error) {
    console.error('Failed to initialize BitTorrent manager:', error);
    console.error('Server is running but P2P functionality will be unavailable');
  }
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down desktop client...`);
  if (btInitialized) {
    try {
      await btManager.destroy();
    } catch (error) {
      console.error('Error destroying BitTorrent manager:', error);
    }
  }
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
