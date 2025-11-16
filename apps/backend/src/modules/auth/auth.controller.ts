import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Patch,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TwoFactorDto } from './dto/two-factor.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { CompletePasswordResetDto } from './dto/complete-password-reset.dto';
import { Roles } from './decorators/roles.decorator';
import { AccountLockoutGuard } from './guards/account-lockout.guard';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';
import { RateLimitingService } from '../../common/rate-limiting/rate-limiting.service';
import { UsersService } from '../users/users.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly rateLimitingService: RateLimitingService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard, LoginRateLimitGuard, AccountLockoutGuard)
  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = this.getIpAddress(req);
    const sessionMetadata = {
      userAgent: req.headers['user-agent'] ?? undefined,
      ipAddress: ip,
    };

    try {
      const result = await this.authService.login(loginDto, sessionMetadata);

      // If 2FA is required, do not issue tokens yet
      if ((result as any).requiresTwoFactor) {
        return result;
      }

      // Clear failed attempts on successful login
      const user = (result as any).user;
      if (user?.id) {
        await this.rateLimitingService.clearFailedLogins(user.id);
      }

      // Record successful attempt (clears rate limit counters)
      await Promise.all([
        this.rateLimitingService.recordAttempt(ip, 'ip', true),
        loginDto.email
          ? this.rateLimitingService.recordAttempt(
              loginDto.email.toLowerCase(),
              'username',
              true,
            )
          : Promise.resolve(),
      ]);

      this.setRefreshTokenCookie(res, (result as any).refreshToken);

      return {
        user: (result as any).user,
        accessToken: (result as any).accessToken,
      };
    } catch (error: any) {
      // Record failed attempt
      if (error.status === 401 && loginDto.email) {
        // Record rate limit attempt (always record, even if user doesn't exist)
        await Promise.all([
          this.rateLimitingService.recordAttempt(ip, 'ip', false),
          this.rateLimitingService.recordAttempt(
            loginDto.email.toLowerCase(),
            'username',
            false,
          ),
        ]);

        // Try to record failed login (only if user exists - don't expose user existence)
        // This is done silently to prevent user enumeration
        try {
          const user = await this.usersService.findByEmail(loginDto.email);
          if (user) {
            await this.rateLimitingService.recordFailedLogin(
              user.id,
              loginDto.email,
            );
          }
        } catch {
          // Ignore errors in recording (don't expose user existence)
        }
      }
      throw error;
    }
  }

  private getIpAddress(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  @Post('register')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() refreshTokenDto?: RefreshTokenDto,
  ) {
    const cookieToken = (req as any).cookies?.refresh_token as string | undefined;
    const bodyToken = refreshTokenDto?.refreshToken;

    const token = cookieToken ?? bodyToken;

    if (!token) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const result = await this.authService.refreshToken(token);

    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
    };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('password-reset/request')
  @ApiOperation({ summary: 'Request a password reset email' })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('password-reset/complete')
  @ApiOperation({ summary: 'Complete password reset using a one-time token' })
  async completePasswordReset(@Body() dto: CompletePasswordResetDto) {
    return this.authService.completePasswordReset(dto.token, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  @Get('2fa/generate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate 2FA secret and QR code' })
  @ApiResponse({ status: 200, description: '2FA secret generated' })
  async generateTwoFactor(@CurrentUser('id') userId: string) {
    return this.authService.generateTwoFactorSecret(userId);
  }

  @Patch('2fa/enable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid 2FA code' })
  async enableTwoFactor(
    @CurrentUser('id') userId: string,
    @Body() twoFactorDto: TwoFactorDto,
  ) {
    return this.authService.enableTwoFactor(userId, twoFactorDto.code);
  }

  @Patch('2fa/disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid 2FA code' })
  async disableTwoFactor(
    @CurrentUser('id') userId: string,
    @Body() twoFactorDto: TwoFactorDto,
  ) {
    return this.authService.disableTwoFactor(userId, twoFactorDto.code);
  }

  /**
   * Set HttpOnly refresh token cookie
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const refreshExpiryConfig = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      AuthService['DEFAULT_REFRESH_EXPIRY'] ?? '30d',
    );

    // Very rough maxAge derivation (in ms) to align cookie with refresh token expiry
    const match = /^(\d+)([smhd])$/.exec(refreshExpiryConfig);
    const amount = match ? Number(match[1]) : 30;
    const unit = match ? match[2] : 'd';
    const multiplier =
      unit === 's'
        ? 1000
        : unit === 'm'
          ? 60_000
          : unit === 'h'
            ? 3_600_000
            : 86_400_000;

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: amount * multiplier,
    });
  }
}

