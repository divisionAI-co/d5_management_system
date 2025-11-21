import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { addHours } from 'date-fns';

import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { RateLimitingService } from '../../common/rate-limiting/rate-limiting.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { UserRole } from '@prisma/client';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: any;
  let emailService: any;
  let configService: any;
  let rateLimitingService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashedPassword123',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.EMPLOYEE,
    isActive: true,
    phone: '+1234567890',
    avatar: null,
    dateOfBirth: null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notificationSettings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockEmailService = {
      sendUserInvitationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockRateLimitingService = {
      unlockAccount: jest.fn(),
      resetLoginCooldown: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RateLimitingService,
          useValue: mockRateLimitingService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
    emailService = module.get(EmailService);
    configService = module.get(ConfigService);
    rateLimitingService = module.get(RateLimitingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith',
      role: UserRole.EMPLOYEE,
      phone: '+1234567890',
    };

    it('should create user with password', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      prismaService.user.create.mockResolvedValue({
        id: 'user-2',
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role,
        isActive: true,
        phone: createUserDto.phone,
        avatar: null,
        dateOfBirth: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await service.create(createUserDto);

      expect(result.email).toBe(createUserDto.email);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(prismaService.user.create).toHaveBeenCalled();
      expect(emailService.sendUserInvitationEmail).not.toHaveBeenCalled();
    });

    it('should create user with invitation email when sendInvite is true', async () => {
      const createWithInvite = { ...createUserDto, sendInvite: true };
      delete createWithInvite.password;

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      prismaService.user.create.mockResolvedValue({
        id: 'user-2',
        email: createWithInvite.email,
        firstName: createWithInvite.firstName,
        lastName: createWithInvite.lastName,
        role: createWithInvite.role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      prismaService.passwordResetToken.create.mockResolvedValue({
        id: 'token-1',
        userId: 'user-2',
        token: 'invite-token',
        expiresAt: addHours(new Date(), 72),
        usedAt: null,
        reason: 'INVITE',
      } as any);
      emailService.sendUserInvitationEmail.mockResolvedValue(undefined);

      const result = await service.create(createWithInvite);

      expect(result.email).toBe(createWithInvite.email);
      expect(prismaService.passwordResetToken.create).toHaveBeenCalled();
      expect(emailService.sendUserInvitationEmail).toHaveBeenCalled();
    });

    it('should throw BadRequestException when password is too short', async () => {
      const createWithShortPassword = { ...createUserDto, password: 'short' };

      await expect(service.create(createWithShortPassword)).rejects.toThrow(BadRequestException);

      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      const createWithUpperCase = {
        ...createUserDto,
        email: 'TEST@EXAMPLE.COM',
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      prismaService.user.create.mockResolvedValue({
        id: 'user-2',
        email: 'test@example.com',
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await service.create(createWithUpperCase);

      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const filters: FilterUsersDto = {
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const mockUsers = [mockUser];
      prismaService.user.count.mockResolvedValue(1);
      prismaService.$transaction.mockResolvedValue([mockUsers, 1]);

      const result = await service.findAll(filters);

      expect(result.data).toEqual(mockUsers);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(25);
    });

    it('should filter by role', async () => {
      const filters: FilterUsersDto = {
        page: 1,
        pageSize: 25,
        role: UserRole.ADMIN,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      prismaService.user.count.mockResolvedValue(0);
      prismaService.$transaction.mockImplementation(async (queries: any[]) => {
        // Execute the queries to verify they're called correctly
        const results = await Promise.all(queries);
        return results;
      });
      prismaService.user.findMany.mockResolvedValue([]);

      await service.findAll(filters);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: UserRole.ADMIN,
          }),
        }),
      );
    });

    it('should exclude roles when provided', async () => {
      const filters: FilterUsersDto = {
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      prismaService.user.count.mockResolvedValue(0);
      prismaService.$transaction.mockImplementation(async (queries: any[]) => {
        // Execute the queries to verify they're called correctly
        const results = await Promise.all(queries);
        return results;
      });
      prismaService.user.findMany.mockResolvedValue([]);

      await service.findAll(filters, [UserRole.EMPLOYEE]);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: {
              notIn: [UserRole.EMPLOYEE],
            },
          }),
        }),
      );
    });

    it('should search by name and email', async () => {
      const filters: FilterUsersDto = {
        page: 1,
        pageSize: 25,
        search: 'john',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      prismaService.user.count.mockResolvedValue(0);
      prismaService.$transaction.mockImplementation(async (queries: any[]) => {
        // Execute the queries to verify they're called correctly
        const results = await Promise.all(queries);
        return results;
      });
      prismaService.user.findMany.mockResolvedValue([]);

      await service.findAll(filters);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.findById('user-1');

      expect(result.id).toBe('user-1');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update user', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        ...updateUserDto,
        updatedAt: new Date(),
      } as any);

      const result = await service.update('user-1', updateUserDto);

      expect(result.firstName).toBe('Updated');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateUserDto,
        select: expect.any(Object),
      });
    });

    it('should hash password when provided', async () => {
      const updateWithPassword = {
        ...updateUserDto,
        password: 'newPassword123',
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      mockedBcrypt.hash.mockResolvedValue('hashedNewPassword' as never);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        ...updateUserDto,
        updatedAt: new Date(),
      } as any);

      await service.update('user-1', updateWithPassword);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          password: 'hashedNewPassword',
        }),
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    const updateProfileDto: UpdateProfileDto = {
      firstName: 'Updated',
      lastName: 'Name',
      phone: '+9876543210',
    };

    it('should update user profile', async () => {
      const updatedUser = {
        ...mockUser,
        ...updateProfileDto,
        updatedAt: new Date(),
      };
      prismaService.user.findUnique
        .mockResolvedValueOnce(mockUser as any) // First call in updateProfile
        .mockResolvedValueOnce(updatedUser as any); // Second call in findById
      prismaService.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.updateProfile('user-1', updateProfileDto);

      expect(result.firstName).toBe('Updated');
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should update email when provided and not in use', async () => {
      const updateWithEmail = {
        ...updateProfileDto,
        email: 'newemail@example.com',
      };

      prismaService.user.findUnique
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(null) // Email not in use
        .mockResolvedValueOnce({
          ...mockUser,
          email: 'newemail@example.com',
        } as any);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        email: 'newemail@example.com',
      } as any);

      await service.updateProfile('user-1', updateWithEmail);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          email: 'newemail@example.com',
        }),
      });
    });

    it('should throw BadRequestException when email is already in use', async () => {
      const updateWithEmail = {
        ...updateProfileDto,
        email: 'existing@example.com',
      };

      prismaService.user.findUnique
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce({ id: 'other-user' } as any); // Email in use by another user

      await expect(service.updateProfile('user-1', updateWithEmail)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update password when current password is valid', async () => {
      const updateWithPassword = {
        ...updateProfileDto,
        currentPassword: 'oldPassword',
        newPassword: 'newPassword123',
      };

      prismaService.user.findUnique
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('hashedNewPassword' as never);
      prismaService.user.update.mockResolvedValue(mockUser as any);

      await service.updateProfile('user-1', updateWithPassword);

      expect(mockedBcrypt.compare).toHaveBeenCalledWith('oldPassword', mockUser.password);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
    });

    it('should throw BadRequestException when current password is invalid', async () => {
      const updateWithPassword = {
        ...updateProfileDto,
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123',
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.updateProfile('user-1', updateWithPassword)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when new password provided without current password', async () => {
      const updateWithPassword = {
        ...updateProfileDto,
        newPassword: 'newPassword123',
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(service.updateProfile('user-1', updateWithPassword)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when firstName is empty', async () => {
      const updateWithEmptyFirstName = {
        ...updateProfileDto,
        firstName: '   ',
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(service.updateProfile('user-1', updateWithEmptyFirstName)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should delete user', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.user.delete.mockResolvedValue(mockUser as any);

      const result = await service.remove('user-1');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate password reset token', async () => {
      prismaService.passwordResetToken.updateMany.mockResolvedValue({ count: 0 } as any);
      prismaService.passwordResetToken.create.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        token: 'reset-token',
        expiresAt: addHours(new Date(), 24),
        usedAt: null,
        reason: 'RESET',
      } as any);

      const result = await service.generatePasswordResetToken('user-1', 24, 'RESET');

      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(prismaService.passwordResetToken.updateMany).toHaveBeenCalled();
      expect(prismaService.passwordResetToken.create).toHaveBeenCalled();
    });

    it('should invalidate previous unused tokens', async () => {
      prismaService.passwordResetToken.updateMany.mockResolvedValue({ count: 2 } as any);
      prismaService.passwordResetToken.create.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        token: 'reset-token',
        expiresAt: addHours(new Date(), 24),
        usedAt: null,
        reason: 'RESET',
      } as any);

      await service.generatePasswordResetToken('user-1', 24, 'RESET');

      expect(prismaService.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          usedAt: null,
        },
        data: {
          usedAt: expect.any(Date),
        },
      });
    });
  });

  describe('validatePasswordResetToken', () => {
    const mockTokenRecord = {
      id: 'token-1',
      userId: 'user-1',
      token: 'reset-token',
      expiresAt: addHours(new Date(), 1),
      usedAt: null,
      reason: 'RESET' as const,
      user: mockUser,
    };

    it('should return token record when valid', async () => {
      prismaService.passwordResetToken.findUnique.mockResolvedValue(mockTokenRecord as any);

      const result = await service.validatePasswordResetToken('reset-token');

      expect(result).toEqual(mockTokenRecord);
    });

    it('should throw BadRequestException when token does not exist', async () => {
      prismaService.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.validatePasswordResetToken('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when token is already used', async () => {
      const usedToken = {
        ...mockTokenRecord,
        usedAt: new Date(),
      };

      prismaService.passwordResetToken.findUnique.mockResolvedValue(usedToken as any);

      await expect(service.validatePasswordResetToken('reset-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when token is expired', async () => {
      const expiredToken = {
        ...mockTokenRecord,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      prismaService.passwordResetToken.findUnique.mockResolvedValue(expiredToken as any);

      await expect(service.validatePasswordResetToken('reset-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setUserPassword', () => {
    it('should update user password', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      prismaService.user.update.mockResolvedValue(mockUser as any);

      await service.setUserPassword('user-1', 'newPassword123');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          password: 'hashedPassword',
        },
      });
    });
  });

  describe('markPasswordResetTokenUsed', () => {
    it('should mark token as used', async () => {
      prismaService.passwordResetToken.update.mockResolvedValue({
        id: 'token-1',
        usedAt: new Date(),
      } as any);

      await service.markPasswordResetTokenUsed('token-1');

      expect(prismaService.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: {
          usedAt: expect.any(Date),
        },
      });
    });
  });

  describe('updateNotificationSettings', () => {
    it('should create notification settings if they do not exist', async () => {
      const settings = {
        emailEnabled: true,
        inAppEnabled: true,
        taskAssigned: true,
      };

      prismaService.notificationSettings.upsert.mockResolvedValue({
        id: 'settings-1',
        userId: 'user-1',
        ...settings,
      } as any);

      const result = await service.updateNotificationSettings('user-1', settings);

      expect(result.userId).toBe('user-1');
      expect(prismaService.notificationSettings.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: settings,
        create: {
          userId: 'user-1',
          ...settings,
        },
      });
    });
  });

  describe('getNotificationSettings', () => {
    it('should return existing notification settings', async () => {
      const mockSettings = {
        id: 'settings-1',
        userId: 'user-1',
        emailEnabled: true,
        inAppEnabled: true,
      };

      prismaService.notificationSettings.findUnique.mockResolvedValue(mockSettings as any);

      const result = await service.getNotificationSettings('user-1');

      expect(result).toEqual(mockSettings);
    });

    it('should create default settings if they do not exist', async () => {
      prismaService.notificationSettings.findUnique.mockResolvedValue(null);
      prismaService.notificationSettings.create.mockResolvedValue({
        id: 'settings-1',
        userId: 'user-1',
        emailEnabled: true,
        inAppEnabled: true,
      } as any);

      const result = await service.getNotificationSettings('user-1');

      expect(result.userId).toBe('user-1');
      expect(prismaService.notificationSettings.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update user active status', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      const result = await service.updateStatus('user-1', { isActive: false });

      expect(result.isActive).toBe(false);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          isActive: false,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset user password', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      mockedBcrypt.hash.mockResolvedValue('hashedNewPassword' as never);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        updatedAt: new Date(),
      } as any);

      const result = await service.resetPassword('user-1', { newPassword: 'newPassword123' });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          password: 'hashedNewPassword',
        },
        select: expect.any(Object),
      });
    });
  });

  describe('resendPasswordResetLink', () => {
    it('should send password reset email', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.passwordResetToken.updateMany.mockResolvedValue({ count: 0 } as any);
      // The service generates a random token, so we capture it from the create call
      let capturedToken: string;
      prismaService.passwordResetToken.create.mockImplementation((args: any) => {
        capturedToken = args.data.token;
        return Promise.resolve({
          id: 'token-1',
          userId: 'user-1',
          token: args.data.token,
          expiresAt: args.data.expiresAt,
          usedAt: null,
          reason: 'RESET',
        });
      });
      emailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.resendPasswordResetLink('user-1');

      expect(result.message).toContain('Password reset email has been sent');
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.any(String),
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.resendPasswordResetLink('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      prismaService.user.findUnique.mockResolvedValue(inactiveUser as any);

      await expect(service.resendPasswordResetLink('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findUsersByMentions', () => {
    it('should find users by email', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
      } as any);

      const result = await service.findUsersByMentions(['test@example.com']);

      expect(result).toEqual(['user-1']);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: { id: true },
      });
    });

    it('should find users by full name', async () => {
      prismaService.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ] as any);

      const result = await service.findUsersByMentions(['John Doe']);

      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          firstName: { equals: 'John', mode: 'insensitive' },
          lastName: { equals: 'Doe', mode: 'insensitive' },
          isActive: true,
        },
        select: { id: true },
      });
    });

    it('should find user by first name only if unique match', async () => {
      prismaService.user.findMany.mockResolvedValue([{ id: 'user-1' }] as any);

      const result = await service.findUsersByMentions(['John']);

      expect(result).toEqual(['user-1']);
    });

    it('should not add user if multiple matches for first name', async () => {
      prismaService.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ] as any);

      const result = await service.findUsersByMentions(['John']);

      expect(result).toEqual([]);
    });

    it('should return empty array for empty identifiers', async () => {
      const result = await service.findUsersByMentions([]);

      expect(result).toEqual([]);
    });

    it('should handle multiple identifiers', async () => {
      prismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1' } as any)
        .mockResolvedValueOnce(null);
      prismaService.user.findMany.mockResolvedValue([{ id: 'user-2' }] as any);

      const result = await service.findUsersByMentions([
        'test@example.com',
        'John Doe',
      ]);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('findByIdWithSecret', () => {
    it('should return user with 2FA secret', async () => {
      const userWithSecret = {
        ...mockUser,
        twoFactorSecret: 'encrypted-secret',
      };

      prismaService.user.findUnique.mockResolvedValue(userWithSecret as any);

      const result = await service.findByIdWithSecret('user-1');

      expect(result.twoFactorSecret).toBe('encrypted-secret');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          twoFactorSecret: true,
        }),
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByIdWithSecret('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unlockAccount', () => {
    it('should unlock user account successfully', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      rateLimitingService.unlockAccount.mockResolvedValue(undefined);

      const result = await service.unlockAccount('user-1');

      expect(result.message).toBe('Account has been unlocked successfully.');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.any(Object),
      });
      expect(rateLimitingService.unlockAccount).toHaveBeenCalledWith('user-1');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.unlockAccount('nonexistent')).rejects.toThrow(NotFoundException);
      expect(rateLimitingService.unlockAccount).not.toHaveBeenCalled();
    });
  });

  describe('resetLoginCooldown', () => {
    it('should reset login cooldown successfully', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      rateLimitingService.resetLoginCooldown.mockResolvedValue(undefined);

      const result = await service.resetLoginCooldown('user-1');

      expect(result.message).toBe('Login cooldown has been reset successfully.');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.any(Object),
      });
      expect(rateLimitingService.resetLoginCooldown).toHaveBeenCalledWith(mockUser.email);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.resetLoginCooldown('nonexistent')).rejects.toThrow(NotFoundException);
      expect(rateLimitingService.resetLoginCooldown).not.toHaveBeenCalled();
    });
  });
});

