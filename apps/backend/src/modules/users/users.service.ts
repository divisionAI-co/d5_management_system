import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { addHours } from 'date-fns';
import { randomBytes } from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BaseService } from '../../common/services/base.service';
import { QueryBuilder } from '../../common/utils/query-builder.util';
import { ErrorMessages } from '../../common/constants/error-messages.const';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmailService } from '../../common/email/email.service';

const USER_PROFILE_SELECT = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  phone: true,
  avatar: true,
  dateOfBirth: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  notificationSettings: {
    select: {
      id: true,
      userId: true,
      emailEnabled: true,
      inAppEnabled: true,
      taskAssigned: true,
      taskDueSoon: true,
      leaveApproved: true,
      performanceReview: true,
      newCandidate: true,
      newOpportunity: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  employee: {
    select: {
      id: true,
      jobTitle: true,
    },
  },
});

@Injectable()
export class UsersService extends BaseService {
  constructor(
    prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {
    super(prisma);
  }

  async create(createUserDto: CreateUserDto) {
    const { sendInvite = false, password, ...rest } = createUserDto;

    const normalizedEmail = rest.email.trim().toLowerCase();
    const sanitizedPhone = rest.phone?.trim() || undefined;

    if (!sendInvite && (!password || password.length < 8)) {
      throw new BadRequestException(ErrorMessages.INVALID_INPUT('password', 'must be at least 8 characters long'));
    }

    const passwordToHash = sendInvite ? this.generateRandomPassword() : password!;
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);

    const user = await this.prisma.user.create({
      data: {
        ...rest,
        email: normalizedEmail,
        phone: sanitizedPhone,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (sendInvite) {
      const { token, expiresAt } = await this.generatePasswordResetToken(
        user.id,
        this.getInviteExpiryHours(),
        'INVITE',
      );

      await this.emailService.sendUserInvitationEmail(user.email, user.firstName, token, expiresAt);
    }

    return user;
  }

  private generateRandomPassword(length = 16) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*()';
    const randomBuffer = randomBytes(length);
    let password = '';

    for (let i = 0; i < length; i++) {
      password += alphabet[randomBuffer[i] % alphabet.length];
    }

    return password;
  }

  private getInviteExpiryHours() {
    return this.getNumberConfig('USER_INVITE_EXPIRY_HOURS', 72);
  }

  private getPasswordResetExpiryHours() {
    return this.getNumberConfig('PASSWORD_RESET_TOKEN_EXPIRY_HOURS', 1);
  }

  private getNumberConfig(key: string, fallback: number) {
    const rawValue = this.configService.get<string>(key);

    if (rawValue === undefined || rawValue === null) {
      return fallback;
    }

    const parsed = Number(rawValue);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return fallback;
  }

  async generatePasswordResetToken(
    userId: string,
    expiresInHours = 24,
    reason: 'RESET' | 'INVITE' = 'RESET',
  ) {
    // Invalidate previous unused tokens
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = addHours(new Date(), expiresInHours);

    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt,
        reason,
      },
    });

    return { token, expiresAt };
  }

  async validatePasswordResetToken(token: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: true,
      },
    });

    if (!record) {
      throw new BadRequestException(ErrorMessages.INVALID_INPUT('reset link', 'invalid or has already been used'));
    }

    if (record.usedAt) {
      throw new BadRequestException(ErrorMessages.INVALID_INPUT('reset link', 'has already been used'));
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException(ErrorMessages.INVALID_INPUT('reset link', 'has expired'));
    }

    return record;
  }

  async markPasswordResetTokenUsed(tokenId: string) {
    await this.prisma.passwordResetToken.update({
      where: { id: tokenId },
      data: {
        usedAt: new Date(),
      },
    });
  }

  async setUserPassword(userId: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });
  }

  async findAll(filters: FilterUsersDto, excludeRoles?: UserRole[]) {
    const {
      page = 1,
      pageSize = 25,
      search,
      role,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    // Build base where clause using QueryBuilder
    const { search: searchFilter, role: roleFilter, isActive: isActiveFilter, ...baseFilters } = filters;
    const baseWhere = QueryBuilder.buildWhereClause<Prisma.UserWhereInput>(
      baseFilters,
      {
        searchFields: ['firstName', 'lastName', 'email'],
      },
    );

    // Handle search manually (QueryBuilder already handles it, but we want to ensure it's trimmed)
    if (search) {
      const trimmed = search.trim();
      if (trimmed) {
        baseWhere.OR = [
          { firstName: { contains: trimmed, mode: Prisma.QueryMode.insensitive } },
          { lastName: { contains: trimmed, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: trimmed, mode: Prisma.QueryMode.insensitive } },
        ];
      }
    }

    // Handle excludeRoles (takes precedence over role filter)
    if (excludeRoles && excludeRoles.length > 0) {
      baseWhere.role = {
        notIn: excludeRoles,
      };
      this.logger.log('[UsersService] Excluding roles:', excludeRoles);
    } else if (roleFilter) {
      // Only use role filter if excludeRoles is not provided
      baseWhere.role = roleFilter;
    }

    // Handle isActive filter
    if (typeof isActiveFilter === 'boolean') {
      baseWhere.isActive = isActiveFilter;
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Use manual pagination since we need to use 'select' instead of 'include'
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: baseWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          phone: true,
          avatar: true,
          dateOfBirth: true,
          twoFactorEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          employee: {
            select: {
              id: true,
              jobTitle: true,
            },
          },
          _count: {
            select: {
              assignedTasks: true,
              assignedLeads: true,
              assignedOpportunities: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where: baseWhere }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PROFILE_SELECT,
    });

    if (!user) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('User', id));
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find users by mention identifiers (email, full name, or first name)
   */
  async findUsersByMentions(identifiers: string[]): Promise<string[]> {
    if (!identifiers || identifiers.length === 0) {
      return [];
    }

    const userIds = new Set<string>();

    for (const identifier of identifiers) {
      const trimmed = identifier.trim();
      if (!trimmed) continue;

      // Try to find by email
      if (trimmed.includes('@')) {
        const user = await this.prisma.user.findUnique({
          where: { email: trimmed },
          select: { id: true },
        });
        if (user) {
          userIds.add(user.id);
          continue;
        }
      }

      // Try to find by full name (FirstName LastName)
      const nameParts = trimmed.split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        const users = await this.prisma.user.findMany({
          where: {
            firstName: { equals: firstName, mode: 'insensitive' },
            lastName: { equals: lastName, mode: 'insensitive' },
            isActive: true,
          },
          select: { id: true },
        });
        users.forEach((user) => userIds.add(user.id));
        continue;
      }

      // Try to find by first name only (if single word)
      if (nameParts.length === 1) {
        const firstName = nameParts[0];
        const users = await this.prisma.user.findMany({
          where: {
            firstName: { equals: firstName, mode: 'insensitive' },
            isActive: true,
          },
          select: { id: true },
        });
        // Only add if exactly one match (to avoid ambiguity)
        if (users.length === 1) {
          userIds.add(users[0].id);
        }
      }
    }

    return Array.from(userIds);
  }

  async findByIdWithSecret(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('User', id));
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findById(id);

    const data: any = { ...updateUserDto };

    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('User', userId));
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) {
      const trimmedFirstName = dto.firstName.trim();

      if (!trimmedFirstName) {
        throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('firstName'));
      }

      data.firstName = trimmedFirstName;
    }

    if (dto.lastName !== undefined) {
      const trimmedLastName = dto.lastName.trim();

      if (!trimmedLastName) {
        throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('lastName'));
      }

      data.lastName = trimmedLastName;
    }

    if (dto.phone !== undefined) {
      const trimmedPhone = dto.phone?.trim();
      data.phone = trimmedPhone ? trimmedPhone : null;
    }

    if (dto.avatar !== undefined) {
      const trimmedAvatar = dto.avatar?.trim();
      data.avatar = trimmedAvatar ? trimmedAvatar : null;
    }

    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    }

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();

      if (normalizedEmail !== existingUser.email) {
        const emailInUse = await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (emailInUse && emailInUse.id !== userId) {
          throw new BadRequestException(ErrorMessages.ALREADY_EXISTS('User', 'email'));
        }

        data.email = normalizedEmail;
      }
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('current password'));
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        existingUser.password,
      );

      if (!isCurrentPasswordValid) {
        throw new BadRequestException(ErrorMessages.INVALID_INPUT('current password', 'incorrect'));
      }

      data.password = await bcrypt.hash(dto.newPassword, 10);
    } else if (dto.currentPassword) {
      throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('new password'));
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data,
      });
    }

    return this.findById(userId);
  }

  async remove(id: string) {
    await this.findById(id);

    return this.prisma.user.delete({
      where: { id },
    });
  }

  async updateNotificationSettings(
    userId: string,
    settings: UpdateNotificationSettingsDto,
  ) {
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      update: settings,
      create: {
        userId,
        ...settings,
      },
    });
  }

  async getNotificationSettings(userId: string) {
    let settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.notificationSettings.create({
        data: { userId },
      });
    }

    return settings;
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: dto.isActive,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async resetPassword(id: string, dto: ResetUserPasswordDto) {
    await this.findById(id);
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    return this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  async resendPasswordResetLink(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('User', id));
    }

    if (!user.isActive) {
      throw new BadRequestException(ErrorMessages.OPERATION_NOT_ALLOWED('send reset link', 'user is inactive'));
    }

    const { token } = await this.generatePasswordResetToken(
      user.id,
      this.getPasswordResetExpiryHours(),
      'RESET',
    );

    await this.emailService.sendPasswordResetEmail(user.email, token);

    return {
      message: 'Password reset email has been sent.',
    };
  }
}

