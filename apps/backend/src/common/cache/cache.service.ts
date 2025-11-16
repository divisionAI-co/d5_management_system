import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis.Redis | null = null;
  private isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled = this.configService.get<string>('REDIS_ENABLED', 'false') === 'true';
  }

  async onModuleInit() {
    if (!this.isEnabled) {
      this.logger.warn('Redis caching is disabled. Set REDIS_ENABLED=true to enable.');
      return;
    }

    try {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');
      const db = this.configService.get<number>('REDIS_DB', 0);

      this.client = new Redis.Redis({
        host,
        port,
        password,
        db,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.client.on('connect', () => {
        this.logger.log('Redis connected successfully');
      });

      this.client.on('error', (error) => {
        this.logger.error('Redis connection error', error);
      });

      // Test connection
      await this.client.ping();
      this.logger.log(`Redis connected to ${host}:${port}`);
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      this.client = null;
      this.isEnabled = false;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL (time to live in seconds)
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isEnabled || !this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      await this.client.del(...keys);
      return keys.length;
    } catch (error) {
      this.logger.error(`Error deleting cache pattern ${pattern}`, error);
      return 0;
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Generate cache key with prefix
   */
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `cache:${prefix}:${parts.join(':')}`;
  }
}

