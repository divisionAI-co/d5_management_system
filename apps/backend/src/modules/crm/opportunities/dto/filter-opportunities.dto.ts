import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterOpportunitiesDto {
  @ApiPropertyOptional({
    description: 'Free text search applied to title, description, and customer name',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by customer identifier',
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by assigned user identifier',
  })
  @IsString()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({
    description: 'Filter by originating lead identifier',
  })
  @IsString()
  @IsOptional()
  leadId?: string;

  @ApiPropertyOptional({
    enum: CustomerType,
    description: 'Filter by opportunity type',
  })
  @IsEnum(CustomerType)
  @IsOptional()
  type?: CustomerType;

  @ApiPropertyOptional({
    description: 'Filter by pipeline stage',
  })
  @IsString()
  @IsOptional()
  stage?: string;

  @ApiPropertyOptional({
    description: 'Filter by closed status',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true';
  })
  isClosed?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by win status',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true';
  })
  isWon?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
  })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
  })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Page size for pagination',
    default: 25,
  })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return 25;
    }
    return Math.min(Math.max(parsed, 1), 100);
  })
  pageSize?: number = 25;

  @ApiPropertyOptional({
    description: 'Field used for sorting',
    default: 'createdAt',
    enum: ['createdAt', 'updatedAt', 'value', 'stage', 'title'],
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}


