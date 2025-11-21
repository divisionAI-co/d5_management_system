import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CaseStudyStatus } from '@prisma/client';

export class FilterCaseStudiesDto {
  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 25,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;

  @ApiPropertyOptional({
    description: 'Search term to filter by title, excerpt, content, or client name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: CaseStudyStatus,
  })
  @IsOptional()
  @IsEnum(CaseStudyStatus)
  status?: CaseStudyStatus;

  @ApiPropertyOptional({
    description: 'Filter by industry',
  })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'title', 'publishedAt', 'projectDate'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'publishedAt' | 'projectDate' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

