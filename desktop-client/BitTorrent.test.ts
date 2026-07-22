import BitTorrentManager from './BitTorrentManager';
import HashVerifier from './HashVerifier';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

describe('BitTorrentManager', () => {
  let btManager: BitTorrentManager;

  beforeEach(() => {
    btManager = new BitTorrentManager();
  });

  afterEach(async () => {
    // Cleanup
    if (btManager) {
      await btManager.destroy();
    }
  });

  test('should initialize successfully', async () => {
    await btManager.initialize();
    // If no error is thrown, initialization succeeded
    expect(true).toBe(true);
  });

  test('should throw error when calling downloadFile before initialization', async () => {
    const magnetLink = 'magnet:?xt=urn:btih:test';
    const savePath = '/tmp/test';

    await expect(btManager.downloadFile(magnetLink, savePath)).rejects.toThrow(
      'BitTorrent client not initialized'
    );
  });

  test('should throw error when seeding non-existent file', async () => {
    await btManager.initialize();

    const nonExistentFile = path.join(os.tmpdir(), 'non_existent_file_12345.txt');
    
    await expect(btManager.seedFile(nonExistentFile)).rejects.toThrow(
      'File not found'
    );
  });

  test('should return null for progress of non-existent torrent', async () => {
    await btManager.initialize();

    const progress = btManager.getProgress('nonexistent_torrent_id');
    expect(progress).toBeNull();
  });

  test('should initialize getAllProgress as empty array', async () => {
    await btManager.initialize();

    const allProgress = btManager.getAllProgress();
    expect(Array.isArray(allProgress)).toBe(true);
    expect(allProgress.length).toBe(0);
  });

  test('should not throw when removing non-existent torrent', async () => {
    await btManager.initialize();

    // Should not throw
    expect(() => btManager.removeTorrent('nonexistent_id')).not.toThrow();
  });

  test('should handle destroy gracefully multiple times', async () => {
    await btManager.initialize();
    await btManager.destroy();
    // Second destroy should not throw
    await expect(btManager.destroy()).resolves.not.toThrow();
  });

  test('should create the download directory before attempting to add the torrent', async () => {
    await btManager.initialize();

    const tempDir = path.join(os.tmpdir(), `test_download_${Date.now()}`);
    const testMagnetLink = 'magnet:?xt=urn:btih:test';

    // A malformed infohash like this one leaves WebTorrent's client.add() callback never
    // firing - covered by the dedicated timeout test below. Here we only care that the
    // directory gets created synchronously before that, so a short timeoutMs keeps this fast.
    await btManager.downloadFile(testMagnetLink, tempDir, undefined, undefined, 500).catch(() => {});

    expect(fs.existsSync(tempDir)).toBe(true);
  });

  test('CRITICAL: downloadFile rejects with a timeout instead of hanging forever on unresolvable torrent metadata', async () => {
    // This is the exact bug that was found and fixed: a magnet link whose metadata never
    // resolves (malformed infohash, or no reachable peers/trackers/DHT) used to leave
    // client.add()'s callback never firing, so the promise never settled. Uses a short
    // timeoutMs override so this test itself stays fast rather than waiting out the real
    // 15s production default.
    await btManager.initialize();

    const tempDir = path.join(os.tmpdir(), `test_timeout_${Date.now()}`);
    const unresolvableMagnetLink = 'magnet:?xt=urn:btih:test';

    await expect(
      btManager.downloadFile(unresolvableMagnetLink, tempDir, undefined, undefined, 500)
    ).rejects.toThrow(/Timed out after 500ms/);
  });
});

describe('HashVerifier', () => {
  const testDir = path.join(os.tmpdir(), 'hash_test');

  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  test('should calculate hash for a test file', async () => {
    const testFile = path.join(testDir, 'test_file.txt');
    const testContent = 'Hello, World!';
    
    fs.writeFileSync(testFile, testContent);

    const hash = await HashVerifier.calculateFileHash(testFile);

    // Should be a valid SHA-256 hash (64 hex characters)
    expect(hash).toMatch(/^[a-f0-9]{64}$/i);

    fs.unlinkSync(testFile);
  });

  test('should return consistent hash for same file content', async () => {
    const testFile = path.join(testDir, 'consistent_hash.txt');
    const testContent = 'Test content for hash consistency';
    
    fs.writeFileSync(testFile, testContent);

    const hash1 = await HashVerifier.calculateFileHash(testFile);
    const hash2 = await HashVerifier.calculateFileHash(testFile);

    expect(hash1).toBe(hash2);

    fs.unlinkSync(testFile);
  });

  test('should calculate different hashes for different content', async () => {
    const file1 = path.join(testDir, 'file1.txt');
    const file2 = path.join(testDir, 'file2.txt');

    fs.writeFileSync(file1, 'Content 1');
    fs.writeFileSync(file2, 'Content 2');

    const hash1 = await HashVerifier.calculateFileHash(file1);
    const hash2 = await HashVerifier.calculateFileHash(file2);

    expect(hash1).not.toBe(hash2);

    fs.unlinkSync(file1);
    fs.unlinkSync(file2);
  });

  test('should verify matching hash', async () => {
    const testFile = path.join(testDir, 'verify_match.txt');
    const testContent = 'Content to verify';

    fs.writeFileSync(testFile, testContent);

    const hash = await HashVerifier.calculateFileHash(testFile);
    const isValid = await HashVerifier.verifyFileHash(testFile, hash);

    expect(isValid).toBe(true);

    fs.unlinkSync(testFile);
  });

  test('should reject non-matching hash', async () => {
    const testFile = path.join(testDir, 'verify_mismatch.txt');
    const testContent = 'Content to verify';

    fs.writeFileSync(testFile, testContent);

    const wrongHash = 'a'.repeat(64); // Invalid hash
    const isValid = await HashVerifier.verifyFileHash(testFile, wrongHash);

    expect(isValid).toBe(false);

    fs.unlinkSync(testFile);
  });

  test('CRITICAL: rejects a file that was tampered with/corrupted after its hash was recorded', async () => {
    // Simulates the real threat model this exists for: a malicious peer serving substitute
    // content, or a corrupted P2P transfer. We hash a known-good file (as the on-chain
    // sha256Digest would have been computed at publish time), then mutate the file's bytes on
    // disk exactly as if a bad download had landed there, and confirm verifyFileHash correctly
    // refuses to treat it as authentic against the original, still-trusted hash.
    const testFile = path.join(testDir, 'tamper_test.bin');
    const originalContent = Buffer.from('This is the original, trusted application binary.');

    fs.writeFileSync(testFile, originalContent);
    const trustedHash = await HashVerifier.calculateFileHash(testFile);

    const mutatedContent = Buffer.from(originalContent);
    mutatedContent[0] = mutatedContent[0] ^ 0xff; // flip a single byte - the smallest possible corruption
    fs.writeFileSync(testFile, mutatedContent);

    const isValid = await HashVerifier.verifyFileHash(testFile, trustedHash);

    expect(isValid).toBe(false);

    fs.unlinkSync(testFile);
  });

  test('should return false for non-existent file during verification', async () => {
    const nonExistentFile = path.join(testDir, 'non_existent.txt');
    const hash = 'a'.repeat(64);

    const isValid = await HashVerifier.verifyFileHash(nonExistentFile, hash);

    expect(isValid).toBe(false);
  });

  test('should calculate string hash correctly', () => {
    const testString = 'Test string';
    const hash = HashVerifier.calculateStringHash(testString);

    // Should be a valid SHA-256 hash
    expect(hash).toMatch(/^[a-f0-9]{64}$/i);
  });

  test('should return consistent string hash', () => {
    const testString = 'Consistent test string';
    const hash1 = HashVerifier.calculateStringHash(testString);
    const hash2 = HashVerifier.calculateStringHash(testString);

    expect(hash1).toBe(hash2);
  });

  test('should return different hash for different strings', () => {
    const hash1 = HashVerifier.calculateStringHash('String 1');
    const hash2 = HashVerifier.calculateStringHash('String 2');

    expect(hash1).not.toBe(hash2);
  });

  test('should handle large file hashing', async () => {
    const largeFile = path.join(testDir, 'large_file.txt');
    
    // Create a 10MB file
    const chunk = Buffer.alloc(1024 * 1024, 'a'); // 1MB chunk
    const stream = fs.createWriteStream(largeFile);
    
    for (let i = 0; i < 10; i++) {
      stream.write(chunk);
    }
    
    await new Promise((resolve) => {
      stream.end(resolve);
    });

    const hash = await HashVerifier.calculateFileHash(largeFile);

    expect(hash).toMatch(/^[a-f0-9]{64}$/i);

    fs.unlinkSync(largeFile);
  });
});

describe('Integration Tests', () => {
  test('should seed a local file and produce a well-formed magnet link', async () => {
    // Seeding is a purely local operation - WebTorrent hashes the file and builds torrent
    // metadata without needing any peers/trackers/DHT to respond, so this must succeed
    // deterministically rather than tolerating failure as a "network issue".
    const btManager = new BitTorrentManager();
    const testDir = path.join(os.tmpdir(), `integration_test_${Date.now()}`);
    const testFile = path.join(testDir, 'app.zip');

    try {
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(testFile, Buffer.alloc(1000)); // 1KB dummy file

      await btManager.initialize();

      const magnetLink = await btManager.seedFile(testFile);

      // A real BitTorrent v1 magnet link: 40 hex character infohash under the xt= param.
      expect(magnetLink).toMatch(/^magnet:\?xt=urn:btih:[a-f0-9]{40}/i);

      await btManager.destroy();
    } finally {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    }
  });

  test('P2P pipeline: a file seeded and then downloaded via its own magnet link resolves to byte-identical content', async () => {
    // Proves the full seed -> magnet link -> resolve pipeline with real (non-mocked)
    // WebTorrent logic: the same client both seeds the source file and then "downloads" it
    // again via the resulting magnet link into a separate directory. WebTorrent dedupes the
    // download onto the torrent it's already fully seeding (see BitTorrentManager.ts's own
    // comments on this exact behavior), so this needs no network/peers to complete - but it
    // still genuinely exercises magnet link parsing, torrent resolution, and the real
    // file-copy path that a true remote download would also go through.
    const btManager = new BitTorrentManager();
    const uploadDir = path.join(os.tmpdir(), `p2p_seed_${Date.now()}`);
    const downloadDir = path.join(os.tmpdir(), `p2p_download_${Date.now()}`);
    const sourceFile = path.join(uploadDir, 'app.bin');
    const originalContent = crypto.randomBytes(64 * 1024);

    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(sourceFile, originalContent);

      await btManager.initialize();

      const magnetLink = await btManager.seedFile(sourceFile);

      let resolvedFilePaths: string[] = [];
      await btManager.downloadFile(magnetLink, downloadDir, (filePaths) => {
        resolvedFilePaths = filePaths;
      });

      expect(resolvedFilePaths).toHaveLength(1);
      expect(fs.existsSync(resolvedFilePaths[0])).toBe(true);

      const resolvedContent = fs.readFileSync(resolvedFilePaths[0]);
      expect(resolvedContent.equals(originalContent)).toBe(true);

      await btManager.destroy();
    } finally {
      fs.rmSync(uploadDir, { recursive: true, force: true });
      fs.rmSync(downloadDir, { recursive: true, force: true });
    }
  }, 20000);

  test('should calculate hash and prepare for upload', async () => {
    const testDir = path.join(os.tmpdir(), `upload_test_${Date.now()}`);
    const testFile = path.join(testDir, 'app.exe');

    try {
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(testFile, 'Fake executable content');

      // Calculate hash
      const fileHash = await HashVerifier.calculateFileHash(testFile);

      expect(fileHash).toMatch(/^[a-f0-9]{64}$/i);
      
      // Verify the hash
      const isValid = await HashVerifier.verifyFileHash(testFile, fileHash);
      expect(isValid).toBe(true);
    } finally {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    }
  });
});
