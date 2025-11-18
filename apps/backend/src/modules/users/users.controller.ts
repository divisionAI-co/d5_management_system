import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all users' })
  findAll(@Query() filters: FilterUsersDto) {
    return this.usersService.findAll(filters);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Get('me/notification-settings')
  @ApiOperation({ summary: 'Get notification settings' })
  getNotificationSettings(@CurrentUser('id') userId: string) {
    return this.usersService.getNotificationSettings(userId);
  }

  @Patch('me/notification-settings')
  @ApiOperation({ summary: 'Update notification settings' })
  updateNotificationSettings(
    @CurrentUser('id') userId: string,
    @Body() settings: UpdateNotificationSettingsDto,
  ) {
    return this.usersService.updateNotificationSettings(userId, settings);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user (Admin only)' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate or deactivate a user (Admin only)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(id, dto);
  }

  @Patch(':id/reset-password')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reset a user password (Admin only)' })
  resetPassword(@Param('id') id: string, @Body() dto: ResetUserPasswordDto) {
    return this.usersService.resetPassword(id, dto);
  }

  @Post(':id/resend-password-reset')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resend a password reset link to a user (Admin only)' })
  resendPasswordReset(@Param('id') id: string) {
    return this.usersService.resendPasswordResetLink(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}

