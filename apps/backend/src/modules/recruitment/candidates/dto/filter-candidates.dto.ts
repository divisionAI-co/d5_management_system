import { ApiPropertyOptional } from '@nestjs/swagger';
import { CandidateStage } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterCandidatesDto {
  @ApiPropertyOptional({
    description:
      'Free text search applied to first name, last name, email, and skills',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: CandidateStage,
    description: 'Filter by candidate stage',
  })
  @IsEnum(CandidateStage)
  @IsOptional()
  stage?: CandidateStage;

  @ApiPropertyOptional({
    description: 'Filter by linked position',
  })
  @IsString()
  @IsOptional()
  positionId?: string;

  @ApiPropertyOptional({
    description: 'Filter by skill keywords',
    type: [String],
    example: ['React', 'Node.js'],
  })
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    return String(value)
      .split(',')
      .map((skill) => skill.trim())
      .filter((skill) => !!skill);
  })
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Only include candidates linked to at least one open position',
  })
  @IsBoolean()
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
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return undefined;
  })
  hasOpenPosition?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by active status. If not provided, defaults to true (only active candidates). Set to false to show inactive candidates, or null to show all.',
  })
  @IsBoolean()
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
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return undefined;
  })
  isActive?: boolean;

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
    // Allow up to 5000 for board views that need to show all candidates
    return Math.min(Math.max(parsed, 1), 5000);
  })
  pageSize?: number = 25;

  @ApiPropertyOptional({
    description: 'Field used for sorting',
    default: 'createdAt',
    enum: ['createdAt', 'updatedAt', 'stage', 'rating', 'firstName'],
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

  @ApiPropertyOptional({
    description: 'Filter by recruiter user ID',
  })
  @IsString()
  @IsOptional()
  recruiterId?: string;
}


