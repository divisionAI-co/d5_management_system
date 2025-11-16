import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { RateLimitingService } from '../../../common/rate-limiting/rate-limiting.service';
import { UsersService } from '../../users/users.service';

/**
 * Guard that checks if an account is locked due to too many failed login attempts
 */
@Injectable()
export class AccountLockoutGuard implements CanActivate {
  constructor(
    private rateLimitingService: RateLimitingService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body || {};
    const email = body.email?.toLowerCase();

    if (!email) {
      return true; // Let validation handle missing email
    }

    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        return true; // User doesn't exist, let auth service handle it
      }

      const lockStatus = await this.rateLimitingService.isAccountLocked(user.id);

      if (lockStatus.locked && lockStatus.lockedUntil) {
        const minutesRemaining = Math.ceil(
          (lockStatus.lockedUntil.getTime() - Date.now()) / (60 * 1000),
        );

        throw new HttpException(
          {
            statusCode: 423, // 423 Locked (RFC 4918)
            message: `Account is temporarily locked due to too many failed login attempts. Please try again in ${minutesRemaining} minute(s).`,
            lockedUntil: lockStatus.lockedUntil,
          },
          423, // HttpStatus.LOCKED doesn't exist, use 423 directly
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If user lookup fails, let the auth service handle it
      return true;
    }
  }
}

