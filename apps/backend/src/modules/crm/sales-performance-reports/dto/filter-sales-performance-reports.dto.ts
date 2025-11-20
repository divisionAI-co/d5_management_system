import { IsOptional, IsString, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FilterSalesPerformanceReportsDto {
  @ApiProperty({ description: 'Filter by salesperson ID', required: false })
  @IsOptional()
  @IsString()
  salespersonId?: string;

  @ApiProperty({ description: 'Filter by week ending from date', required: false })
  @IsOptional()
  @IsDateString()
  weekEndingFrom?: string;

  @ApiProperty({ description: 'Filter by week ending to date', required: false })
  @IsOptional()
  @IsDateString()
  weekEndingTo?: string;

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ description: 'Page size', required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

