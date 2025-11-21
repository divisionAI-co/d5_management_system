import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../../common/email/email.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '@prisma/client';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock speakeasy
jest.mock('speakeasy');
const mockedSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;

// Mock QRCode
jest.mock('qrcode');
const mockedQRCode = QRCode as jest.Mocked<typeof QRCode>;

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;
  let usersService: any;
  let jwtService: any;
  let configService: any;
  let emailService: any;
  let encryptionService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashedPassword123',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.EMPLOYEE,
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    phone: null,
    avatar: null,
    dateOfBirth: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserWithoutPassword = {
    id: mockUser.id,
    email: mockUser.email,
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    role: mockUser.role,
    isActive: mockUser.isActive,
    twoFactorEnabled: mockUser.twoFactorEnabled,
    avatar: mockUser.avatar,
    createdAt: mockUser.createdAt,
    dateOfBirth: mockUser.dateOfBirth,
    lastLoginAt: mockUser.lastLoginAt,
    phone: mockUser.phone,
    twoFactorSecret: mockUser.twoFactorSecret,
    updatedAt: mockUser.updatedAt,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByIdWithSecret: jest.fn(),
      generatePasswordResetToken: jest.fn(),
      validatePasswordResetToken: jest.fn(),
      setUserPassword: jest.fn(),
      markPasswordResetTokenUsed: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockEmailService = {
      sendPasswordResetEmail: jest.fn(),
    };

    const mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    emailService = module.get<EmailService>(EmailService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual(mockUserWithoutPassword);
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword123');
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      usersService.findByEmail.mockResolvedValue(inactiveUser);

      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.validateUser('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockedBcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword123');
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should return user and tokens on successful login', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      prismaService.user.update.mockResolvedValue(mockUser);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      configService.get.mockReturnValue('30d');
      prismaService.userSession.create.mockResolvedValue({
        id: 'session-1',
        userId: mockUser.id,
        tokenHash: 'hash',
        expiresAt: new Date(),
      } as any);

      const result = await service.login(loginDto);

      expect((result as any).user).toEqual(mockUserWithoutPassword);
      expect((result as any).accessToken).toBe('access-token');
      expect((result as any).refreshToken).toBe('refresh-token');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should require 2FA code when 2FA is enabled', async () => {
      const userWith2FA = { ...mockUser, twoFactorEnabled: true };
      usersService.findByEmail.mockResolvedValue(userWith2FA);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login(loginDto);

      expect(result.requiresTwoFactor).toBe(true);
      expect(result.message).toBe('2FA code required');
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should verify 2FA code when provided', async () => {
      const userWith2FA = { ...mockUser, twoFactorEnabled: true };
      const loginWith2FA = { ...loginDto, twoFactorCode: '123456' };

      usersService.findByEmail.mockResolvedValue(userWith2FA);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jest.spyOn(service, 'verifyTwoFactorCode' as any).mockResolvedValue(true);
      prismaService.user.update.mockResolvedValue(userWith2FA);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      configService.get.mockReturnValue('30d');
      prismaService.userSession.create.mockResolvedValue({
        id: 'session-1',
        userId: mockUser.id,
        tokenHash: 'hash',
        expiresAt: new Date(),
      } as any);

      const result = await service.login(loginWith2FA);

      expect((result as any).user).toEqual({
        ...mockUserWithoutPassword,
        twoFactorEnabled: true,
      });
      expect((result as any).accessToken).toBe('access-token');
    });

    it('should throw UnauthorizedException when 2FA code is invalid', async () => {
      const userWith2FA = { ...mockUser, twoFactorEnabled: true };
      const loginWith2FA = { ...loginDto, twoFactorCode: 'wrong-code' };

      usersService.findByEmail.mockResolvedValue(userWith2FA);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jest.spyOn(service, 'verifyTwoFactorCode' as any).mockResolvedValue(false);

      await expect(service.login(loginWith2FA)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith',
      role: UserRole.EMPLOYEE,
      phone: '+1234567890',
    };

    it('should create user and return tokens', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      prismaService.user.create.mockResolvedValue({
        id: 'user-2',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: registerDto.role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      configService.get.mockReturnValue('30d');
      prismaService.userSession.create.mockResolvedValue({
        id: 'session-1',
        userId: 'user-2',
        tokenHash: 'hash',
        expiresAt: new Date(),
      } as any);

      const result = await service.register(registerDto);

      expect(result.user.email).toBe(registerDto.email);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(prismaService.user.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);

      expect(prismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      configService.get.mockReturnValue('30d');
      prismaService.userSession.create.mockResolvedValue({
        id: 'session-1',
        userId: mockUser.id,
        tokenHash: 'hash',
        expiresAt: new Date(),
      } as any);

      const result = await service.generateTokens(mockUserWithoutPassword);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(prismaService.userSession.create).toHaveBeenCalled();
    });

    it('should include session metadata when provided', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      configService.get.mockReturnValue('30d');
      prismaService.userSession.create.mockResolvedValue({
        id: 'session-1',
        userId: mockUser.id,
        tokenHash: 'hash',
        expiresAt: new Date(),
      } as any);

      await service.generateTokens(mockUserWithoutPassword, {
        sessionMetadata: {
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        },
      });

      expect(prismaService.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        }),
      });
    });
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'refresh-token-string';
    const mockSessionId = 'session-1';
    const mockPayload = {
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
      sid: mockSessionId,
    };

    it('should generate new tokens with valid refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);
      prismaService.userSession.findUnique.mockResolvedValue({
        id: mockSessionId,
        userId: mockUser.id,
        tokenHash: crypto.createHash('sha256').update(mockRefreshToken).digest('hex'),
        expiresAt: new Date(Date.now() + 86400000), // Future date
        revokedAt: null,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      } as any);
      usersService.findById.mockResolvedValue(mockUserWithoutPassword);
      prismaService.userSession.update.mockResolvedValue({} as any);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      configService.get.mockReturnValue('30d');
      prismaService.userSession.create.mockResolvedValue({
        id: 'session-2',
        userId: mockUser.id,
        tokenHash: 'hash',
        expiresAt: new Date(),
      } as any);

      const result = await service.refreshToken(mockRefreshToken);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(prismaService.userSession.update).toHaveBeenCalledWith({
        where: { id: mockSessionId },
        data: {
          revokedAt: expect.any(Date),
          lastUsedAt: expect.any(Date),
        },
      });
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when session does not exist', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);
      prismaService.userSession.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when session is revoked', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);
      prismaService.userSession.findUnique.mockResolvedValue({
        id: mockSessionId,
        userId: mockUser.id,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // Already revoked
      } as any);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when session is expired', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);
      prismaService.userSession.findUnique.mockResolvedValue({
        id: mockSessionId,
        userId: mockUser.id,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 86400000), // Past date
        revokedAt: null,
      } as any);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token hash does not match', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);
      prismaService.userSession.findUnique.mockResolvedValue({
        id: mockSessionId,
        userId: mockUser.id,
        tokenHash: 'different-hash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      } as any);
      prismaService.userSession.update.mockResolvedValue({} as any);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(UnauthorizedException);

      expect(prismaService.userSession.update).toHaveBeenCalledWith({
        where: { id: mockSessionId },
        data: {
          revokedAt: expect.any(Date),
          lastUsedAt: expect.any(Date),
        },
      });
    });
  });

  describe('requestPasswordReset', () => {
    it('should send password reset email for existing active user', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.generatePasswordResetToken.mockResolvedValue({
        token: 'reset-token',
        expiresAt: new Date(),
      });
      emailService.sendPasswordResetEmail.mockResolvedValue(true);

      const result = await service.requestPasswordReset('test@example.com');

      expect(result.message).toContain('reset link has been sent');
      expect(usersService.generatePasswordResetToken).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        'reset-token',
      );
    });

    it('should return success message even when user does not exist (prevent enumeration)', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.requestPasswordReset('nonexistent@example.com');

      expect(result.message).toContain('reset link has been sent');
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should return success message for inactive user (prevent enumeration)', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      usersService.findByEmail.mockResolvedValue(inactiveUser);

      const result = await service.requestPasswordReset('test@example.com');

      expect(result.message).toContain('reset link has been sent');
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('completePasswordReset', () => {
    const mockTokenRecord = {
      id: 'token-1',
      userId: mockUser.id,
      token: 'reset-token',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      reason: 'RESET' as const,
    };

    it('should reset password and mark token as used', async () => {
      usersService.validatePasswordResetToken.mockResolvedValue(mockTokenRecord as any);
      usersService.setUserPassword.mockResolvedValue(undefined);
      usersService.markPasswordResetTokenUsed.mockResolvedValue(undefined);

      const result = await service.completePasswordReset('reset-token', 'newPassword123');

      expect(result.message).toBe('Password has been reset successfully.');
      expect(usersService.setUserPassword).toHaveBeenCalledWith(mockUser.id, 'newPassword123');
      expect(usersService.markPasswordResetTokenUsed).toHaveBeenCalledWith('token-1');
    });
  });

  describe('Two-Factor Authentication', () => {
    describe('generateTwoFactorSecret', () => {
      it('should generate 2FA secret and QR code', async () => {
        const mockSecret = {
          base32: 'JBSWY3DPEHPK3PXP',
          otpauth_url: 'otpauth://totp/division5%20(test%40example.com)?secret=JBSWY3DPEHPK3PXP',
        };

        usersService.findByIdWithSecret.mockResolvedValue(mockUser);
        mockedSpeakeasy.generateSecret.mockReturnValue(mockSecret as any);
        encryptionService.encrypt.mockReturnValue('encrypted-secret');
        prismaService.user.update.mockResolvedValue(mockUser);
        (mockedQRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,...');

        const result = await service.generateTwoFactorSecret(mockUser.id);

        expect(result.secret).toBe(mockSecret.base32);
        expect(result.qrCode).toBe('data:image/png;base64,...');
        expect(encryptionService.encrypt).toHaveBeenCalledWith(mockSecret.base32);
        expect(prismaService.user.update).toHaveBeenCalledWith({
          where: { id: mockUser.id },
          data: { twoFactorSecret: 'encrypted-secret' },
        });
      });
    });

    describe('enableTwoFactor', () => {
      it('should enable 2FA with valid code', async () => {
        const userWithSecret = {
          ...mockUser,
          twoFactorSecret: 'encrypted-secret',
        };

        usersService.findByIdWithSecret.mockResolvedValue(userWithSecret);
        encryptionService.decrypt.mockReturnValue('JBSWY3DPEHPK3PXP');
        (mockedSpeakeasy.totp.verify as jest.Mock).mockReturnValue(true);
        prismaService.user.update.mockResolvedValue({
          ...userWithSecret,
          twoFactorEnabled: true,
        } as any);

        const result = await service.enableTwoFactor(mockUser.id, '123456');

        expect(result.message).toBe('2FA enabled successfully');
        expect(mockedSpeakeasy.totp.verify).toHaveBeenCalledWith({
          secret: 'JBSWY3DPEHPK3PXP',
          encoding: 'base32',
          token: '123456',
          window: 2,
        });
        expect(prismaService.user.update).toHaveBeenCalledWith({
          where: { id: mockUser.id },
          data: { twoFactorEnabled: true },
        });
      });

      it('should throw BadRequestException when secret is missing', async () => {
        usersService.findByIdWithSecret.mockResolvedValue(mockUser);

        await expect(service.enableTwoFactor(mockUser.id, '123456')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException when code is invalid', async () => {
        const userWithSecret = {
          ...mockUser,
          twoFactorSecret: 'encrypted-secret',
        };

        usersService.findByIdWithSecret.mockResolvedValue(userWithSecret);
        encryptionService.decrypt.mockReturnValue('JBSWY3DPEHPK3PXP');
        (mockedSpeakeasy.totp.verify as jest.Mock).mockReturnValue(false);

        await expect(service.enableTwoFactor(mockUser.id, 'wrong-code')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('disableTwoFactor', () => {
      it('should disable 2FA with valid code', async () => {
        const userWith2FA = {
          ...mockUser,
          twoFactorEnabled: true,
          twoFactorSecret: 'encrypted-secret',
        };

        jest.spyOn(service, 'verifyTwoFactorCode' as any).mockResolvedValue(true);
        prismaService.user.update.mockResolvedValue({
          ...userWith2FA,
          twoFactorEnabled: false,
          twoFactorSecret: null,
        } as any);

        const result = await service.disableTwoFactor(mockUser.id, '123456');

        expect(result.message).toBe('2FA disabled successfully');
        expect(prismaService.user.update).toHaveBeenCalledWith({
          where: { id: mockUser.id },
          data: {
            twoFactorEnabled: false,
            twoFactorSecret: null,
          },
        });
      });

      it('should throw BadRequestException when code is invalid', async () => {
        jest.spyOn(service, 'verifyTwoFactorCode' as any).mockResolvedValue(false);

        await expect(service.disableTwoFactor(mockUser.id, 'wrong-code')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('verifyTwoFactorCode', () => {
      it('should return true for valid 2FA code', async () => {
        const userWithSecret = {
          ...mockUser,
          twoFactorSecret: 'encrypted-secret',
        };

        usersService.findByIdWithSecret.mockResolvedValue(userWithSecret);
        encryptionService.decrypt.mockReturnValue('JBSWY3DPEHPK3PXP');
        (mockedSpeakeasy.totp.verify as jest.Mock).mockReturnValue(true);

        const result = await service.verifyTwoFactorCode(mockUser.id, '123456');

        expect(result).toBe(true);
      });

      it('should return false when secret is missing', async () => {
        usersService.findByIdWithSecret.mockResolvedValue(mockUser);

        const result = await service.verifyTwoFactorCode(mockUser.id, '123456');

        expect(result).toBe(false);
      });

      it('should return false when code is invalid', async () => {
        const userWithSecret = {
          ...mockUser,
          twoFactorSecret: 'encrypted-secret',
        };

        usersService.findByIdWithSecret.mockResolvedValue(userWithSecret);
        encryptionService.decrypt.mockReturnValue('JBSWY3DPEHPK3PXP');
        (mockedSpeakeasy.totp.verify as jest.Mock).mockReturnValue(false);

        const result = await service.verifyTwoFactorCode(mockUser.id, 'wrong-code');

        expect(result).toBe(false);
      });
    });
  });

  describe('calculateRefreshExpiryDate', () => {
    it('should calculate expiry date from days', () => {
      const result = (service as any).calculateRefreshExpiryDate('30d');
      const expected = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      expect(result.getTime()).toBeCloseTo(expected.getTime(), -3); // Within 1 second
    });

    it('should calculate expiry date from hours', () => {
      const result = (service as any).calculateRefreshExpiryDate('24h');
      const expected = new Date(Date.now() + 24 * 60 * 60 * 1000);

      expect(result.getTime()).toBeCloseTo(expected.getTime(), -3);
    });

    it('should default to 30 days for invalid format', () => {
      const result = (service as any).calculateRefreshExpiryDate('invalid');
      const expected = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      expect(result.getTime()).toBeCloseTo(expected.getTime(), -3);
    });
  });

  describe('hashToken', () => {
    it('should hash token using SHA256', () => {
      const token = 'test-token';
      const result = (service as any).hashToken(token);
      const expected = crypto.createHash('sha256').update(token).digest('hex');

      expect(result).toBe(expected);
    });
  });
});

