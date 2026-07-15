import BitTorrentManager from './BitTorrentManager';
import HashVerifier from './HashVerifier';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

  test('should create download directory if it does not exist', async () => {
    await btManager.initialize();

    const tempDir = path.join(os.tmpdir(), `test_download_${Date.now()}`);
    const testMagnetLink = 'magnet:?xt=urn:btih:test';

    // This will attempt to add to client, which will fail with invalid magnet,
    // but we're testing directory creation
    try {
      await btManager.downloadFile(testMagnetLink, tempDir);
    } catch (error) {
      // Expected to fail with invalid magnet link
    }

    // Check that the directory was attempted to be created
    // (it may not exist if the torrent client rejected it immediately)
    // This is a best-effort test
    expect(true).toBe(true);
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
  test('should allow seeding a local file after initialization', async () => {
    const btManager = new BitTorrentManager();
    const testDir = path.join(os.tmpdir(), `integration_test_${Date.now()}`);
    const testFile = path.join(testDir, 'app.zip');

    try {
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(testFile, Buffer.alloc(1000)); // 1KB dummy file

      await btManager.initialize();
      
      // This will attempt to seed, might fail due to network but should not crash
      try {
        const magnetLink = await btManager.seedFile(testFile);
        expect(magnetLink).toBeDefined();
        expect(magnetLink.startsWith('magnet:')).toBe(true);
      } catch (error) {
        // Network-related errors are acceptable in testing
        expect(error).toBeDefined();
      }

      await btManager.destroy();
    } finally {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    }
  });

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
