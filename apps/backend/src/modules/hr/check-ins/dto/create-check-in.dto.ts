import { IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInStatus } from '@prisma/client';

export class CreateCheckInDto {
  @ApiProperty({ description: 'Date of check-in (YYYY-MM-DD)' })
  @IsDateString()
  date!: string;

  @ApiProperty({ description: 'Date-time of check-in (ISO 8601)' })
  @IsDateString()
  time!: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ description: 'Employee card number' })
  @IsString()
  employeeCardNumber!: string;

  @ApiProperty({ enum: CheckInStatus, description: 'IN or OUT status' })
  @IsEnum(CheckInStatus)
  status!: CheckInStatus;

  @ApiProperty({ description: 'Employee ID - required to link check-in to employee' })
  @IsString()
  employeeId!: string;
}

