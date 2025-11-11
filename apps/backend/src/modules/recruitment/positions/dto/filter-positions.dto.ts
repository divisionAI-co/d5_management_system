import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

const STATUS_OPTIONS = ['Open', 'Filled', 'Cancelled'] as const;
type PositionStatus = (typeof STATUS_OPTIONS)[number];

export class FilterPositionsDto {
  @ApiPropertyOptional({
    description:
      'Free text search applied to position title, description, and customer name',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by position status',
    enum: STATUS_OPTIONS,
  })
  @IsString()
  @IsOptional()
  status?: PositionStatus;

  @ApiPropertyOptional({
    description: 'Filter by customer identifier',
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by opportunity identifier',
  })
  @IsString()
  @IsOptional()
  opportunityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by linked candidate identifier',
  })
  @IsString()
  @IsOptional()
  candidateId?: string;

  @ApiPropertyOptional({
    description: 'Limit positions to specific requirements keywords',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter((item) => !!item);
  })
  keywords?: string[];

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
    enum: ['createdAt', 'updatedAt', 'title', 'status'],
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


