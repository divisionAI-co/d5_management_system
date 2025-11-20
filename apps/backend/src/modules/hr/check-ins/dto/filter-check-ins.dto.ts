import { IsString, IsDateString, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class FilterCheckInsDto {
  @ApiPropertyOptional({ description: 'Filter by employee ID' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by employee card number' })
  @IsString()
  @IsOptional()
  employeeCardNumber?: string;

  @ApiPropertyOptional({ description: 'Filter by status (IN or OUT)' })
  @IsEnum(CheckInStatus)
  @IsOptional()
  status?: CheckInStatus;

  @ApiPropertyOptional({ description: 'Filter by start date (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Search by first name or last name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  pageSize?: number = 50;
}

