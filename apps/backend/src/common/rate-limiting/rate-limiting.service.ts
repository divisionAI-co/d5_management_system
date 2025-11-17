import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds until retry allowed
}

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Maximum attempts per window
  identifier: string; // IP address or username
  type: 'ip' | 'username';
}

@Injectable()
export class RateLimitingService {
  private readonly defaultWindowMs: number;
  private readonly defaultMaxAttempts: number;
  private readonly lockoutDurationMs: number;
  private readonly maxFailedAttempts: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Configurable via environment variables
    this.defaultWindowMs =
      this.configService.get<number>('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000) || // 15 minutes
      15 * 60 * 1000;
    this.defaultMaxAttempts =
      this.configService.get<number>('RATE_LIMIT_MAX_ATTEMPTS', 10) || 10; // Increased from 5 to 10
    this.lockoutDurationMs =
      this.configService.get<number>('ACCOUNT_LOCKOUT_DURATION_MS', 15 * 60 * 1000) || // 15 minutes (reduced from 30)
      15 * 60 * 1000;
    this.maxFailedAttempts =
      this.configService.get<number>('MAX_FAILED_LOGIN_ATTEMPTS', 10) || 10; // Increased from 5 to 10
  }

  /**
   * Check if a request should be rate limited
   */
  async checkRateLimit(
    options: RateLimitOptions,
  ): Promise<RateLimitResult> {
    const { windowMs, maxAttempts, identifier, type } = options;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    // Get recent attempts
    const attempts = await this.prisma.rateLimitAttempt.findMany({
      where: {
        identifier,
        type,
        createdAt: {
          gte: windowStart,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const attemptCount = attempts.length;
    const remaining = Math.max(0, maxAttempts - attemptCount);
    const resetAt = new Date(
      attempts.length > 0
        ? attempts[attempts.length - 1].createdAt.getTime() + windowMs
        : now.getTime() + windowMs,
    );

    if (attemptCount >= maxAttempts) {
      const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  /**
   * Record a failed attempt (for rate limiting)
   */
  async recordAttempt(
    identifier: string,
    type: 'ip' | 'username',
    success: boolean = false,
  ): Promise<void> {
    await this.prisma.rateLimitAttempt.create({
      data: {
        identifier,
        type,
        success,
      },
    });

    // Clean up old attempts (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await this.prisma.rateLimitAttempt.deleteMany({
      where: {
        createdAt: {
          lt: oneHourAgo,
        },
      },
    });
  }

  /**
   * Check if an account is locked due to too many failed login attempts
   */
  async isAccountLocked(userId: string): Promise<{
    locked: boolean;
    lockedUntil?: Date;
  }> {
    const lockout = await this.prisma.accountLockout.findUnique({
      where: { userId },
    });

    if (!lockout) {
      return { locked: false };
    }

    const now = new Date();
    if (lockout.lockedUntil && lockout.lockedUntil > now) {
      return {
        locked: true,
        lockedUntil: lockout.lockedUntil,
      };
    }

    // Lockout expired, clean it up
    await this.prisma.accountLockout.delete({
      where: { userId },
    });

    return { locked: false };
  }

  /**
   * Record a failed login attempt and lock account if threshold is reached
   */
  async recordFailedLogin(userId: string, email: string): Promise<void> {
    // Get recent failed attempts
    const recentFailures = await this.prisma.failedLoginAttempt.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - this.defaultWindowMs),
        },
      },
    });

    // Record this failure
    await this.prisma.failedLoginAttempt.create({
      data: {
        userId,
        email,
      },
    });

    // Check if we should lock the account
    if (recentFailures.length + 1 >= this.maxFailedAttempts) {
      const lockedUntil = new Date(Date.now() + this.lockoutDurationMs);

      await this.prisma.accountLockout.upsert({
        where: { userId },
        create: {
          userId,
          lockedUntil,
          reason: 'Too many failed login attempts',
        },
        update: {
          lockedUntil,
          reason: 'Too many failed login attempts',
        },
      });
    }
  }

  /**
   * Clear failed login attempts and unlock account after successful login
   */
  async clearFailedLogins(userId: string): Promise<void> {
    await Promise.all([
      this.prisma.failedLoginAttempt.deleteMany({
        where: { userId },
      }),
      this.prisma.accountLockout.deleteMany({
        where: { userId },
      }),
    ]);
  }

  /**
   * Get failed login attempt count for a user
   */
  async getFailedLoginCount(userId: string): Promise<number> {
    const windowStart = new Date(Date.now() - this.defaultWindowMs);
    return this.prisma.failedLoginAttempt.count({
      where: {
        userId,
        createdAt: {
          gte: windowStart,
        },
      },
    });
  }
}

