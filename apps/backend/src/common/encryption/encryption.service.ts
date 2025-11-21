import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Encryption service for sensitive data at rest.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * IMPORTANT: Set ENCRYPTION_KEY environment variable (32-byte hex string or 64 hex chars).
 * Generate with: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!encryptionKey) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY environment variable is required for data encryption',
      );
    }

    // Support both hex string (64 chars) and base64
    if (encryptionKey.length === 64 && /^[0-9a-fA-F]+$/.test(encryptionKey)) {
      this.key = Buffer.from(encryptionKey, 'hex');
    } else {
      // Try to derive a 32-byte key from the provided string
      this.key = crypto.createHash('sha256').update(encryptionKey).digest();
    }

    if (this.key.length !== 32) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY must be 32 bytes (64 hex characters or a string that hashes to 32 bytes)',
      );
    }
  }

  /**
   * Encrypts a string value.
   * Returns a base64-encoded string containing: iv (12 bytes) + authTag (16 bytes) + ciphertext
   */
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined || plaintext === '') {
      return null;
    }

    try {
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const authTag = cipher.getAuthTag();

      // Combine: IV (12 bytes) + AuthTag (16 bytes) + Encrypted data
      const combined = Buffer.concat([iv, authTag, encrypted]);

      return combined.toString('base64');
    } catch (error) {
      throw new InternalServerErrorException(
        'Encryption failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Decrypts a base64-encoded encrypted string.
   * Expects format: iv (12 bytes) + authTag (16 bytes) + ciphertext
   */
  decrypt(encrypted: string | null | undefined): string | null {
    if (encrypted === null || encrypted === undefined || encrypted === '') {
      return null;
    }

    try {
      const combined = Buffer.from(encrypted, 'base64');

      if (combined.length < 28) {
        // Minimum: 12 (IV) + 16 (authTag) = 28 bytes
        throw new Error('Invalid encrypted data format');
      }

      const iv = combined.subarray(0, 12);
      const authTag = combined.subarray(12, 28);
      const ciphertext = combined.subarray(28);

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      // If decryption fails, it might be unencrypted legacy data
      // Log the error but return the original value to allow migration
      this.logger.warn('Decryption failed, returning original value (may be unencrypted legacy data):', error);
      return encrypted;
    }
  }

  /**
   * Checks if a string appears to be encrypted (base64 format with minimum length)
   */
  isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    try {
      const decoded = Buffer.from(value, 'base64');
      return decoded.length >= 28; // Minimum size for IV + authTag
    } catch {
      return false;
    }
  }
}

