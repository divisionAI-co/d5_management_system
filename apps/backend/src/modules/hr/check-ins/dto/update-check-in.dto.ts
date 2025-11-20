import { IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInStatus } from '@prisma/client';

export class UpdateCheckInDto {
  @ApiPropertyOptional({ description: 'Date of check-in (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ description: 'Date-time of check-in (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  time?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Employee card number' })
  @IsString()
  @IsOptional()
  employeeCardNumber?: string;

  @ApiPropertyOptional({ enum: CheckInStatus, description: 'IN or OUT status' })
  @IsEnum(CheckInStatus)
  @IsOptional()
  status?: CheckInStatus;

  @ApiPropertyOptional({ description: 'Optional employee ID if card number matches an employee' })
  @IsString()
  @IsOptional()
  employeeId?: string;
}

