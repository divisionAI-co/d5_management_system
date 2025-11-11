import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerSentiment, CustomerStatus, CustomerType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

const SORTABLE_FIELDS = ['name', 'createdAt', 'updatedAt', 'monthlyValue'];

export class FilterCustomersDto {
  @ApiPropertyOptional({ description: 'Search term for name, email, industry or domain' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: CustomerType })
  @IsEnum(CustomerType)
  @IsOptional()
  type?: CustomerType;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsEnum(CustomerStatus)
  @IsOptional()
  status?: CustomerStatus;

  @ApiPropertyOptional({ enum: CustomerSentiment })
  @IsEnum(CustomerSentiment)
  @IsOptional()
  sentiment?: CustomerSentiment;

  @ApiPropertyOptional({ description: 'Filter by country' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    description: 'Comma separated list of tags (uses hasEvery matching)',
    type: String,
    example: 'enterprise,priority',
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    return undefined;
  })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 25 })
  @Transform(({ value }) => (value ? Number(value) : 25))
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: SORTABLE_FIELDS,
    default: 'createdAt',
  })
  @IsString()
  @IsOptional()
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  @Transform(({ value }) => (value === 'asc' ? 'asc' : 'desc'))
  sortOrder: 'asc' | 'desc' = 'desc';
}


