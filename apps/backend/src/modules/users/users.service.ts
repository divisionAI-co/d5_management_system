import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { addHours } from 'date-fns';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
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
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { sendInvite = false, password, ...rest } = createUserDto;

    const normalizedEmail = rest.email.trim().toLowerCase();
    const sanitizedPhone = rest.phone?.trim() || undefined;

    if (!sendInvite && (!password || password.length < 8)) {
      throw new BadRequestException('Password must be provided and at least 8 characters long.');
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
      throw new BadRequestException('Reset link is invalid or has already been used.');
    }

    if (record.usedAt) {
      throw new BadRequestException('Reset link has already been used.');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Reset link has expired.');
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

  async findAll(filters: FilterUsersDto) {
    const {
      page = 1,
      pageSize = 25,
      search,
      role,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      const trimmed = search.trim();
      if (trimmed) {
        where.OR = [
          { firstName: { contains: trimmed, mode: 'insensitive' } },
          { lastName: { contains: trimmed, mode: 'insensitive' } },
          { email: { contains: trimmed, mode: 'insensitive' } },
        ];
      }
    }

    if (role) {
      where.role = role;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
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
      this.prisma.user.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PROFILE_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
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
      throw new NotFoundException(`User with ID ${id} not found`);
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
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) {
      const trimmedFirstName = dto.firstName.trim();

      if (!trimmedFirstName) {
        throw new BadRequestException('First name cannot be empty');
      }

      data.firstName = trimmedFirstName;
    }

    if (dto.lastName !== undefined) {
      const trimmedLastName = dto.lastName.trim();

      if (!trimmedLastName) {
        throw new BadRequestException('Last name cannot be empty');
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
          throw new BadRequestException('Email address is already in use');
        }

        data.email = normalizedEmail;
      }
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required to set a new password');
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        existingUser.password,
      );

      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      data.password = await bcrypt.hash(dto.newPassword, 10);
    } else if (dto.currentPassword) {
      throw new BadRequestException('New password is required when providing the current password');
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
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!user.isActive) {
      throw new BadRequestException('Cannot send reset link for an inactive user.');
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

