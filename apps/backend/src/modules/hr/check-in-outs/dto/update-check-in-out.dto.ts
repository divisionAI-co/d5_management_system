import { IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInOutStatus } from '@prisma/client';

export class UpdateCheckInOutDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateTime?: string;

  @ApiPropertyOptional({ enum: CheckInOutStatus })
  @IsEnum(CheckInOutStatus)
  @IsOptional()
  status?: CheckInOutStatus;
}

