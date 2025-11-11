import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class FilterContactsDto {
  @ApiPropertyOptional({ description: 'Search term applied to name, email, phone or company' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter contacts by customer identifier' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Return only contacts not linked to a customer' })
  @IsBoolean()
  @Transform(({ value }) => (value === 'true' || value === true ? true : undefined))
  @IsOptional()
  unassigned?: boolean;

  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @Transform(({ value }) => (value ? Number(value) : 1))
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 25 })
  @Transform(({ value }) => (value ? Number(value) : 25))
  @Min(1)
  @Max(100)
  pageSize: number = 25;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['createdAt', 'updatedAt', 'firstName', 'lastName'], default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy: 'createdAt' | 'updatedAt' | 'firstName' | 'lastName' = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], default: 'desc' })
  @Transform(({ value }) => (value === 'asc' ? 'asc' : 'desc'))
  @IsOptional()
  sortOrder: 'asc' | 'desc' = 'desc';
}
