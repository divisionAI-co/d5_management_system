import { IsString, IsEnum, IsDateString, IsOptional, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInOutStatus } from '@prisma/client';

export class FilterCheckInOutsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ enum: CheckInOutStatus })
  @IsEnum(CheckInOutStatus)
  @IsOptional()
  status?: CheckInOutStatus;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  pageSize?: number;
}

