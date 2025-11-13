import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEnum,
  IsIn,
 IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FilterUsersDto {
  @ApiPropertyOptional({
    description: 'Search by name or email (case-insensitive)',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter by user role',
    example: UserRole.ACCOUNT_MANAGER,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @Transform(({ value, obj, key }) => {
    const raw = obj?.[key] ?? value;
    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }
    if (typeof raw === 'boolean') {
      return raw;
    }
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
      }
    }
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Page number (starts at 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Page size (max 100)',
    default: 25,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['firstName', 'lastName', 'email', 'role', 'createdAt', 'lastLoginAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['firstName', 'lastName', 'email', 'role', 'createdAt', 'lastLoginAt'])
  sortBy: 'firstName' | 'lastName' | 'email' | 'role' | 'createdAt' | 'lastLoginAt' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}


