import { IsString, IsDateString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType, LeaveRequestStatus } from '@prisma/client';

export class CreateLeaveRequestDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiProperty({ enum: LeaveType })
  @IsEnum(LeaveType)
  type!: LeaveType;

  @ApiProperty()
  @IsNumber()
  totalDays!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ enum: LeaveRequestStatus, default: LeaveRequestStatus.PENDING })
  @IsEnum(LeaveRequestStatus)
  @IsOptional()
  status?: LeaveRequestStatus;
}

