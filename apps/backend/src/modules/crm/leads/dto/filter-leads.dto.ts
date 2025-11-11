import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class FilterLeadsDto {
  @ApiPropertyOptional({ description: 'Search term applied to title, contact name or email' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;

  @ApiPropertyOptional({ description: 'Filter by assigned salesperson' })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Filter by contact identifier' })
  @IsUUID()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Filter by converted customer identifier' })
  @IsUUID()
  @IsOptional()
  convertedCustomerId?: string;

  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 25 })
  @Transform(({ value }) => (value ? Number(value) : 25))
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize: number = 25;

  @ApiPropertyOptional({ description: 'Sort by field', enum: ['createdAt', 'updatedAt', 'probability', 'value'], default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy: 'createdAt' | 'updatedAt' | 'probability' | 'value' = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], default: 'desc' })
  @Transform(({ value }) => (value === 'asc' ? 'asc' : 'desc'))
  @IsOptional()
  sortOrder: 'asc' | 'desc' = 'desc';
}
