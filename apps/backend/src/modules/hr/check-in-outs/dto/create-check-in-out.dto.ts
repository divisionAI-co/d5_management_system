import { IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInOutStatus } from '@prisma/client';

export class CreateCheckInOutDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty()
  @IsDateString()
  dateTime!: string;

  @ApiProperty({ enum: CheckInOutStatus })
  @IsEnum(CheckInOutStatus)
  status!: CheckInOutStatus;
}

