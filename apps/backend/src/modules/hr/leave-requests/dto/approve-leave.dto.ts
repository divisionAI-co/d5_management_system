import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveRequestStatus } from '@prisma/client';

export class ApproveLeaveDto {
  @ApiProperty({ enum: LeaveRequestStatus })
  @IsEnum(LeaveRequestStatus)
  status!: LeaveRequestStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

