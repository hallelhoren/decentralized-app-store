import WebTorrent from 'webtorrent';
import * as fs from 'fs';
import * as path from 'path';

export interface TorrentProgress {
  id: string;
  progress: number;
  speed: number;
  eta: number;
  downloaded: number;
  total: number;
}

export class BitTorrentManager {
  private client: WebTorrent.Instance | null = null;
  private torrents: Map<string, WebTorrent.Torrent> = new Map();
  private progressMap: Map<string, TorrentProgress> = new Map();

  /**
   * Initialize the WebTorrent client
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.client = new WebTorrent();

        this.client.on('error', (err) => {
          console.error('WebTorrent client error:', err);
        });

        console.log('BitTorrent client initialized');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Download a file using a magnet link
   * @param magnetLink The magnet link to download
   * @param savePath The local directory where the file should be saved
   * @param onDone Optional callback fired once the download completes, with the absolute paths of the downloaded files
   * @returns Promise that resolves to the torrent id (info hash) once the download has started (not completed)
   */
  async downloadFile(
    magnetLink: string,
    savePath: string,
    onDone?: (filePaths: string[]) => void,
    onError?: (err: Error) => void
  ): Promise<string> {
    if (!this.client) {
      throw new Error('BitTorrent client not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      try {
        const dir = savePath;
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        this.client!.add(magnetLink, { path: dir }, (torrent) => {
          const torrentId = torrent.infoHash;
          this.torrents.set(torrentId, torrent);

          this.progressMap.set(torrentId, {
            id: torrentId,
            progress: 0,
            speed: 0,
            eta: 0,
            downloaded: 0,
            total: torrent.length,
          });

          const progressInterval = setInterval(() => {
            const progress = torrent.progress * 100;
            const downloadSpeed = torrent.downloadSpeed;
            const eta = downloadSpeed > 0
              ? (torrent.length - torrent.downloaded) / downloadSpeed
              : 0;

            this.progressMap.set(torrentId, {
              id: torrentId,
              progress,
              speed: downloadSpeed,
              eta,
              downloaded: torrent.downloaded,
              total: torrent.length,
            });
          }, 1000);

          let doneHandled = false;
          const handleDone = () => {
            if (doneHandled) return; // client.add() can dedupe onto an already-registered
            doneHandled = true;      // torrent (e.g. one this same process is seeding) whose
            clearInterval(progressInterval); // 'done' event already fired in the past - guard
            console.log(`[${torrentId}] Download completed`);             // against double-fire.

            this.progressMap.set(torrentId, {
              id: torrentId,
              progress: 100,
              speed: 0,
              eta: 0,
              downloaded: torrent.length,
              total: torrent.length,
            });

            // torrent.path is the directory WebTorrent actually stored the data under - for a
            // fresh download that's `dir`, but if this torrent already existed in the client
            // (e.g. this same process is also seeding it, which is the common case when
            // testing upload+download on one machine), it's wherever *that* copy lives instead
            // - meaning nothing would ever actually land in the app's own download folder,
            // even though verification correctly reports success against the real file. Copy
            // into `dir` explicitly whenever the source isn't already there, so a completed
            // download always leaves a real, discoverable file at the expected location.
            const filePaths = torrent.files.map((f) => {
              const sourcePath = path.join(torrent.path, f.path);
              const destPath = path.join(dir, f.path);
              if (path.resolve(sourcePath) !== path.resolve(destPath)) {
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(sourcePath, destPath);
              }
              return destPath;
            });
            onDone?.(filePaths);
          };

          torrent.on('done', handleDone);
          // A duplicate/already-complete torrent won't emit 'done' again, so check directly.
          if (torrent.progress >= 1) handleDone();

          torrent.on('error', (err) => {
            clearInterval(progressInterval);
            console.error(`[${torrentId}] Torrent error:`, err);
            this.torrents.delete(torrentId);
            this.progressMap.delete(torrentId);
            // By the time a real torrent error fires, downloadFile()'s promise has almost
            // always already resolved (resolve() runs synchronously right after this listener
            // is attached, inside the same client.add() callback) - so reject() below only
            // catches the rare case where this fires before that. The caller relies on
            // onError to learn about failures that happen after it already got a torrentId.
            onError?.(err instanceof Error ? err : new Error(String(err)));
            reject(err);
          });

          resolve(torrentId);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Seed a local file on the BitTorrent network
   * @param filePath Path to the file to seed
   * @returns Promise that resolves to the magnet link
   */
  async seedFile(filePath: string): Promise<string> {
    if (!this.client) {
      throw new Error('BitTorrent client not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(filePath)) {
          return reject(new Error(`File not found: ${filePath}`));
        }

        // client.add() is for adding an *existing* torrent (magnet link / .torrent file /
        // info hash) - passing it a plain content file makes parse-torrent try to bencode-decode
        // that file as torrent metadata, which fails and never calls back (the error surfaces on
        // the client's 'error' event instead), so the promise hangs forever. client.seed() is the
        // method that creates a new torrent from raw file content, which is what publishing needs.
        this.client!.seed(filePath, (torrent) => {
          const magnetLink = torrent.magnetURI;
          const torrentId = torrent.infoHash;

          this.torrents.set(torrentId, torrent);
          console.log(`[${torrentId}] Started seeding: ${filePath}`);
          console.log(`[${torrentId}] Magnet link: ${magnetLink}`);

          resolve(magnetLink);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get the current progress of a download
   */
  getProgress(torrentId: string): TorrentProgress | null {
    return this.progressMap.get(torrentId) || null;
  }

  /**
   * Get all active torrents and their progress
   */
  getAllProgress(): TorrentProgress[] {
    return Array.from(this.progressMap.values());
  }

  /**
   * Stop seeding or downloading a torrent
   */
  removeTorrent(torrentId: string): void {
    const torrent = this.torrents.get(torrentId);
    if (torrent) {
      this.client!.remove(torrent, { destroyStore: false }, (err) => {
        if (err) {
          console.error(`Error removing torrent ${torrentId}:`, err);
        } else {
          console.log(`Torrent ${torrentId} removed`);
        }
      });
      this.torrents.delete(torrentId);
      this.progressMap.delete(torrentId);
    }
  }

  /**
   * Destroy the BitTorrent client (cleanup)
   */
  async destroy(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.destroy((err) => {
          if (err) {
            console.error('Error destroying WebTorrent client:', err);
          } else {
            console.log('BitTorrent client destroyed');
          }
          this.client = null;
          this.torrents.clear();
          this.progressMap.clear();
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default BitTorrentManager;
