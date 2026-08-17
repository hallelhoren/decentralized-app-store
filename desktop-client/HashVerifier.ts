import * as crypto from 'crypto';
import * as fs from 'fs';

// Part of Module C from the HLD (Desktop P2P Client): the security layer that guarantees a
// downloaded binary matches the SHA-256 digest anchored on-chain, independent of whether the
// P2P network or the cache server is trustworthy.

export class HashVerifier {
  /**
   * Calculate SHA-256 hash of a file
   * @param filePath Path to the file
   * @returns Promise that resolves to the hex-encoded SHA-256 hash
   */
  static async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('error', (err) => {
        reject(err);
      });

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
    });
  }

  /**
   * Verify that a file matches the expected hash. Comparison is case-insensitive and
   * tolerant of an optional "0x" prefix, since the expected hash usually comes straight
   * from a bytes32 on-chain value.
   */
  static async verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await this.calculateFileHash(filePath);
      return HashVerifier.normalize(actualHash) === HashVerifier.normalize(expectedHash);
    } catch (error) {
      return false;
    }
  }

  static normalize(hash: string): string {
    return hash.trim().toLowerCase().replace(/^0x/, '');
  }

  /**
   * Calculate SHA-256 hash of a string
   */
  static calculateStringHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export default HashVerifier;
