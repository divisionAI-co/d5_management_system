import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateLeadStatusDto {
  @ApiPropertyOptional({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;

  @ApiPropertyOptional({ description: 'Probability of closing (0-100)', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  probability?: number;

  @ApiPropertyOptional({ description: 'Reason for losing the lead' })
  @IsString()
  @IsOptional()
  lostReason?: string;

  @ApiPropertyOptional({ description: 'Actual close date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  actualCloseDate?: string;
}
