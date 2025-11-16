import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!rawKey) {
      throw new Error(
        'ENCRYPTION_KEY is not set. Please configure a 32-byte key (base64 or hex encoded) for encryption.',
      );
    }

    let keyBuffer: Buffer | null = null;

    // Try base64 first, then hex
    try {
      keyBuffer = Buffer.from(rawKey, 'base64');
    } catch {
      // ignore
    }

    if (!keyBuffer || keyBuffer.length === 0) {
      try {
        keyBuffer = Buffer.from(rawKey, 'hex');
      } catch {
        // ignore
      }
    }

    if (!keyBuffer || keyBuffer.length !== 32) {
      throw new Error(
        'ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits) for AES-256-GCM.',
      );
    }

    this.key = keyBuffer;
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Store as: iv (12 bytes) | authTag (16 bytes) | ciphertext
    const payload = Buffer.concat([iv, authTag, ciphertext]).toString('base64');
    return payload;
  }

  decrypt(payload?: string | null): string | null {
    if (!payload) {
      return null;
    }

    const buffer = Buffer.from(payload, 'base64');

    if (buffer.length < 12 + 16) {
      // Not a valid payload
      return null;
    }

    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }
}


