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
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true';
  })
  hasOpenPosition?: boolean;

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
}


