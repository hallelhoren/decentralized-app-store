import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as crypto from 'crypto';
import BitTorrentManager from './BitTorrentManager';
import HashVerifier from './HashVerifier';

// The only interface the web UI has into Module C (Desktop P2P Client): a local Express API
// (default port 3001, see DESKTOP_API_PORT) exposing /api/download, /api/status, and /api/upload
// over BitTorrentManager + HashVerifier. See web-ui/src/lib/desktop-client.ts for the caller side.

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
    // Each upload gets its own subdirectory so the file itself can keep its real name - that
    // name is what ends up in the torrent's file listing / magnet `dn`, and later becomes the
    // downloader's Content-Disposition filename, so mangling it here (e.g. a timestamp prefix
    // to dodge collisions) would otherwise follow the file all the way to the user's browser.
    destination: (_req, _file, cb) => {
      const dir = path.join(UPLOADS_DIR, crypto.randomUUID());
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, file.originalname),
  }),
});

interface DownloadState {
  appId: string;
  // What was actually requested for this appId - compared against future requests so a newly
  // published version (a different magnetLink for the same appId) invalidates the cache
  // instead of silently keeping serving whatever version happened to download first.
  magnetLink: string;
  torrentId: string;
  savePath: string;
  expectedHash?: string;
  // null = nothing to verify yet (still downloading, or caller supplied no expected hash)
  verified: boolean | null;
  // Absolute paths of the downloaded file(s), set once the torrent's 'done' event fires -
  // this is what GET /api/download/file serves.
  filePaths?: string[];
  // Set if the torrent errors out after the initial request already returned 200 - lets
  // /api/status report a real failure instead of polling 'idle' forever, and lets a
  // subsequent POST /api/download retry instead of being stuck behind a dead entry.
  error?: string;
}

// Web UI / Next.js cache server only ever needs to think in terms of appId, not torrent
// info-hashes - this map is what makes that possible.
const downloadsByAppId = new Map<string, DownloadState>();

// Start (or resume polling) a download. The expected on-chain SHA-256 digest is supplied by
// the caller (the Next.js cache server, which reads it from its indexed DB) so this process
// never needs its own blockchain RPC connection just to verify a file.
app.post('/api/download', async (req: Request, res: Response) => {
  // Hoisted so the catch block below can mark this as errored if downloadFile() itself
  // rejects (e.g. the new metadata-resolution timeout in BitTorrentManager) - otherwise the
  // bookkeeping entry registered just before that await would be left stuck forever with no
  // torrentId and no error, which GET /api/status can't distinguish from "still in progress"
  // and which the existing.error retry branch below would never unblock.
  let state: DownloadState | undefined;

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
      if (!existing.error && existing.magnetLink === magnetLink) {
        // Same version already downloading/downloaded for this appId - dedupe rather than
        // starting a second torrent for identical content.
        return res.json({ status: 'started', appId, torrentId: existing.torrentId, savePath: existing.savePath });
      }

      // Either the previous attempt errored, or - the common case - a developer published a
      // new version after the old one already finished downloading here, so this request's
      // magnetLink no longer matches what's cached for this appId. Tear down the old torrent
      // and delete its downloaded file(s) before falling through to start a fresh download;
      // otherwise the old version's file would just sit there and keep getting served forever
      // (savePath is keyed only by appId, so the new download would land right on top of it).
      if (existing.torrentId) await btManager.removeTorrent(existing.torrentId);
      await fs.promises.rm(existing.savePath, { recursive: true, force: true }).catch(() => {});
      downloadsByAppId.delete(appId);
    }

    const savePath = path.join(APPS_DIR, appId);

    // Registered *before* the download starts, and mutated in place afterwards: a torrent
    // that's already fully cached in this process (e.g. it's also being seeded here) can
    // complete synchronously, inside client.add()'s own callback - i.e. before
    // btManager.downloadFile()'s promise even resolves. If this bookkeeping entry were only
    // added after that await, the completion callback below would look it up, find nothing,
    // and silently skip verification.
    state = { appId, magnetLink, torrentId: '', savePath, expectedHash, verified: null };
    downloadsByAppId.set(appId, state);

    const torrentId = await btManager.downloadFile(
      magnetLink,
      savePath,
      async (filePaths) => {
        state!.filePaths = filePaths;
        if (expectedHash && filePaths.length > 0) {
          try {
            state!.verified = await HashVerifier.verifyFileHash(filePaths[0], expectedHash);
            console.log(`[${appId}] hash verification ${state!.verified ? 'PASSED' : 'FAILED'}`);
          } catch (err) {
            console.error(`[${appId}] hash verification error:`, err);
            state!.verified = false;
          }
        }
      },
      (err) => {
        state!.error = err.message;
      }
    );

    state.torrentId = torrentId;

    res.json({ status: 'started', appId, torrentId, savePath });
  } catch (error) {
    console.error('Download endpoint error:', error);
    if (state) {
      state.error = error instanceof Error ? error.message : String(error);
    }
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

  if (state.error) {
    return res.json({ status: 'error', progress: 0, verified: state.verified, error: state.error });
  }

  if (!state.torrentId) {
    // Registered but torrent metadata/peer discovery hasn't resolved yet, so there's no
    // progressMap entry to look up. A download has genuinely started - report in_progress
    // rather than idle, which would be indistinguishable from no download at all.
    return res.json({ status: 'in_progress', progress: 0, verified: null });
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

// Serves the actual completed file bytes so the browser can save it locally. Refuses to
// serve anything that failed hash verification, and won't serve before the torrent's
// 'done' event has populated filePaths.
app.get('/api/download/file', (req: Request, res: Response) => {
  const appId = req.query.appId as string;
  if (!appId) {
    return res.status(400).json({ error: 'appId is required' });
  }

  const state = downloadsByAppId.get(appId);
  if (!state) {
    return res.status(404).json({ error: 'No download found for this appId' });
  }
  if (state.verified === false) {
    return res.status(403).json({ error: 'Hash verification failed; refusing to serve file' });
  }
  if (!state.filePaths || state.filePaths.length === 0) {
    return res.status(409).json({ error: 'Download has not finished yet' });
  }

  const filePath = state.filePaths[0];
  if (!fs.existsSync(filePath)) {
    return res.status(410).json({ error: 'Downloaded file is no longer on disk' });
  }

  res.download(filePath, path.basename(filePath), (err) => {
    if (err) {
      console.error(`[${appId}] Error serving file to client:`, err);
    }
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
  const entries = await fs.promises.readdir(UPLOADS_DIR).catch(() => [] as string[]);
  for (const entry of entries) {
    const entryPath = path.join(UPLOADS_DIR, entry);
    try {
      const stat = await fs.promises.stat(entryPath);
      // New layout: one subdirectory per upload, holding the file under its real name. Old
      // layout (uploads from before per-upload subdirectories): the file sits directly in
      // UPLOADS_DIR - still seeded as-is, since already-published torrentRefs anchored
      // on-chain from that layout need to keep resolving to the same infoHash.
      const filePath = stat.isDirectory()
        ? path.join(entryPath, (await fs.promises.readdir(entryPath))[0] ?? '')
        : entryPath;
      if (!filePath || !fs.existsSync(filePath)) continue;

      const magnetLink = await btManager.seedFile(filePath);
      console.log(`[reseed] resumed seeding ${path.basename(filePath)}: ${magnetLink}`);
    } catch (error) {
      console.error(`[reseed] failed to reseed ${entry}:`, error);
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
