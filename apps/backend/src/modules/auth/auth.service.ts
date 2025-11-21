import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BaseService } from '../../common/services/base.service';
import { ErrorMessages } from '../../common/constants/error-messages.const';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailService } from '../../common/email/email.service';
import { EncryptionService } from '../../common/encryption/encryption.service';

@Injectable()
export class AuthService extends BaseService {
  private static readonly DEFAULT_REFRESH_EXPIRY = '30d';

  constructor(
    prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private encryptionService: EncryptionService,
  ) {
    super(prisma);
  }

  async validateUser(email: string, password: string): Promise<any> {
    this.logger.log(`[ValidateUser] Attempting to validate user: ${email}`);
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      this.logger.warn(`[ValidateUser] User not found: ${email}`);
      throw new UnauthorizedException(ErrorMessages.UNAUTHORIZED('access this account'));
    }

    this.logger.log(`[ValidateUser] User found: ${user.id}, isActive: ${user.isActive}, twoFactorEnabled: ${user.twoFactorEnabled}`);

    if (!user.isActive) {
      this.logger.warn(`[ValidateUser] User is inactive: ${user.id}`);
      throw new UnauthorizedException(ErrorMessages.OPERATION_NOT_ALLOWED('login', 'Account is inactive'));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    this.logger.log(`[ValidateUser] Password validation result: ${isPasswordValid}`);
    
    if (!isPasswordValid) {
      this.logger.warn(`[ValidateUser] Invalid password for user: ${email}`);
      throw new UnauthorizedException(ErrorMessages.UNAUTHORIZED('access this account'));
    }

    this.logger.log(`[ValidateUser] User validated successfully: ${user.email} (${user.id})`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = user;
    return result;
  }

  async login(
    loginDto: LoginDto,
    sessionMetadata?: {
      userAgent?: string;
      ipAddress?: string;
    },
  ) {
    this.logger.log(`[Login] Login attempt for: ${loginDto.email}, IP: ${sessionMetadata?.ipAddress || 'unknown'}`);
    
    const user = await this.validateUser(loginDto.email, loginDto.password);
    this.logger.log(`[Login] User validated, proceeding with login for: ${user.email} (${user.id})`);

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      this.logger.log(`[Login] 2FA enabled for user: ${user.id}`);
      if (!loginDto.twoFactorCode) {
        this.logger.log(`[Login] 2FA code required for user: ${user.id}`);
        return {
          requiresTwoFactor: true,
          message: '2FA code required',
        };
      }

      const isValid = await this.verifyTwoFactorCode(user.id, loginDto.twoFactorCode);
      this.logger.log(`[Login] 2FA code validation result: ${isValid}`);
      if (!isValid) {
        this.logger.warn(`[Login] Invalid 2FA code for user: ${user.id}`);
        throw new UnauthorizedException(ErrorMessages.INVALID_INPUT('2FA code'));
      }
    }

    // Update last login
    this.logger.log(`[Login] Updating last login for user: ${user.id}`);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`[Login] Generating tokens for user: ${user.id}`);
    const tokens = await this.generateTokens(user, {
      sessionMetadata,
    });
    
    this.logger.log(`[Login] Login successful for user: ${user.email} (${user.id})`);
    return {
      user,
      ...tokens,
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    
    if (existingUser) {
      throw new BadRequestException(ErrorMessages.ALREADY_EXISTS('User', 'email'));
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: registerDto.role,
        phone: registerDto.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user);

    return {
      user,
      ...tokens,
    };
  }

  async generateTokens(
    user: any,
    options?: {
      sessionMetadata?: {
        userAgent?: string;
        ipAddress?: string;
      };
    },
  ) {
    const sessionId = crypto.randomUUID();

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };

    const refreshExpiryConfig = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      AuthService.DEFAULT_REFRESH_EXPIRY,
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiryConfig,
      }),
    ]);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = this.calculateRefreshExpiryDate(refreshExpiryConfig);

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: options?.sessionMetadata?.userAgent,
        ipAddress: options?.sessionMetadata?.ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (!payload?.sid) {
        throw new UnauthorizedException(ErrorMessages.UNAUTHORIZED('refresh token'));
      }

      const session = await this.prisma.userSession.findUnique({
        where: { id: payload.sid },
      });

      if (!session) {
        throw new UnauthorizedException(ErrorMessages.UNAUTHORIZED('refresh token'));
      }

      if (session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException(ErrorMessages.UNAUTHORIZED('refresh token'));
      }

      const presentedHash = this.hashToken(refreshToken);

      if (presentedHash !== session.tokenHash) {
        await this.prisma.userSession.update({
          where: { id: session.id },
          data: {
            revokedAt: new Date(),
            lastUsedAt: new Date(),
          },
        });

        throw new UnauthorizedException(ErrorMessages.UNAUTHORIZED('refresh token'));
      }

      const user = await this.usersService.findById(payload.sub);
      
      if (!user || !user.isActive) {
        throw new UnauthorizedException(ErrorMessages.UNAUTHORIZED('use this token'));
      }

      await this.prisma.userSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          lastUsedAt: new Date(),
        },
      });

      return this.generateTokens(user, {
        sessionMetadata: {
          userAgent: session.userAgent ?? undefined,
          ipAddress: session.ipAddress ?? undefined,
        },
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private calculateRefreshExpiryDate(configValue: string) {
    const match = /^(\d+)([smhd])$/.exec(configValue ?? '');

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

    return new Date(Date.now() + amount * multiplier);
  }

  private getPasswordResetExpiryHours() {
    const rawValue = this.configService.get<string>('PASSWORD_RESET_TOKEN_EXPIRY_HOURS');

    if (rawValue === undefined || rawValue === null) {
      return 1;
    }

    const parsed = Number(rawValue);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return 1;
  }

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.isActive) {
      // Always respond with success message to prevent email enumeration
      return {
        message: 'If an account exists for this email, a reset link has been sent.',
      };
    }

    const { token } = await this.usersService.generatePasswordResetToken(
      user.id,
      this.getPasswordResetExpiryHours(),
      'RESET',
    );

    await this.emailService.sendPasswordResetEmail(user.email, token);

    return {
      message: 'If an account exists for this email, a reset link has been sent.',
    };
  }

  async completePasswordReset(token: string, newPassword: string) {
    const record = await this.usersService.validatePasswordResetToken(token);

    await this.usersService.setUserPassword(record.userId, newPassword);
    await this.usersService.markPasswordResetTokenUsed(record.id);

    return {
      message: 'Password has been reset successfully.',
    };
  }

  // Two-Factor Authentication
  async generateTwoFactorSecret(userId: string) {
    const user = await this.usersService.findByIdWithSecret(userId);
    const appName = this.configService.get<string>(
      'TWO_FACTOR_AUTHENTICATION_APP_NAME',
      'division5',
    );

    const secret = speakeasy.generateSecret({
      name: `${appName} (${user.email})`,
      length: 32,
    });

    // Store the secret temporarily (will be confirmed later) - encrypted
    const encryptedSecret = this.encryptionService.encrypt(secret.base32);
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptedSecret },
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await this.usersService.findByIdWithSecret(userId);

    if (!user.twoFactorSecret) {
      throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('2FA secret'));
    }

    // Decrypt the secret before verification
    const decryptedSecret = this.encryptionService.decrypt(user.twoFactorSecret);
    if (!decryptedSecret) {
      throw new BadRequestException(ErrorMessages.INVALID_INPUT('2FA secret'));
    }

    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!isValid) {
      throw new BadRequestException(ErrorMessages.INVALID_INPUT('2FA code'));
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { message: '2FA enabled successfully' };
  }

  async disableTwoFactor(userId: string, code: string) {
    const isValid = await this.verifyTwoFactorCode(userId, code);

    if (!isValid) {
      throw new BadRequestException('Invalid 2FA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return { message: '2FA disabled successfully' };
  }

  async verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
    const user = await this.usersService.findByIdWithSecret(userId);

    if (!user.twoFactorSecret) {
      return false;
    }

    // Decrypt the secret before verification
    const decryptedSecret = this.encryptionService.decrypt(user.twoFactorSecret);
    if (!decryptedSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });
  }
}

