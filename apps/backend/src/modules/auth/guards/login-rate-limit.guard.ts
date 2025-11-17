import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
  CanActivate,
} from '@nestjs/common';
import { Request } from 'express';
import { RateLimitingService } from '../../../common/rate-limiting/rate-limiting.service';

/**
 * Enhanced rate limiting guard for login endpoints
 * Tracks both IP-based and username-based attempts
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private rateLimitingService: RateLimitingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getIpAddress(request);
    const body = request.body || {};
    const email = body.email?.toLowerCase();

    // Check IP-based rate limiting (10 attempts per 15 minutes - more lenient)
    const ipLimit = await this.rateLimitingService.checkRateLimit({
      identifier: ip,
      type: 'ip',
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 10, // Increased from 5 to 10
    });

    if (!ipLimit.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many login attempts from this IP address. Please try again later.',
          retryAfter: ipLimit.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check username-based rate limiting if email is provided (10 attempts per 15 minutes - more lenient)
    if (email) {
      const usernameLimit = await this.rateLimitingService.checkRateLimit({
        identifier: email,
        type: 'username',
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxAttempts: 10, // Increased from 5 to 10
      });

      if (!usernameLimit.allowed) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many login attempts for this account. Please try again later.',
            retryAfter: usernameLimit.retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }

  private getIpAddress(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}

