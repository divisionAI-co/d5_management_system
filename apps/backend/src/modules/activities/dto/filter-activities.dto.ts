import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityVisibility } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FilterActivitiesDto {
  @ApiPropertyOptional({ description: 'Search by subject or body content' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by activity type' })
  @IsUUID()
  @IsOptional()
  activityTypeId?: string;

  @ApiPropertyOptional({ enum: ActivityVisibility })
  @IsEnum(ActivityVisibility)
  @IsOptional()
  visibility?: ActivityVisibility;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  leadId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  opportunityId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  candidateId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  taskId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  quoteId?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned user', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Return only pinned activities' })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: 'Return only completed activities' })
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @ApiPropertyOptional({ description: 'Minimum activity date (inclusive)', format: 'date-time' })
  @IsDateString()
  @IsOptional()
  activityDateFrom?: string;

  @ApiPropertyOptional({ description: 'Maximum activity date (inclusive)', format: 'date-time' })
  @IsDateString()
  @IsOptional()
  activityDateTo?: string;

  @ApiPropertyOptional({ description: 'Minimum creation date', format: 'date-time' })
  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Maximum creation date', format: 'date-time' })
  @IsDateString()
  @IsOptional()
  createdTo?: string;

  @ApiPropertyOptional({ description: 'Pagination page', default: 1, minimum: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 25, minimum: 5, maximum: 100 })
  @IsNumber()
  @Min(5)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 25;

  @ApiPropertyOptional({
    description: 'Sort column',
    enum: ['createdAt', 'activityDate', 'reminderAt', 'subject'],
    default: 'createdAt',
  })
  @IsIn(['createdAt', 'activityDate', 'reminderAt', 'subject'])
  @IsOptional()
  sortBy?: 'createdAt' | 'activityDate' | 'reminderAt' | 'subject' = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}


