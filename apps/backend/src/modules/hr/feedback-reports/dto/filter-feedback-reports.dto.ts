import { IsOptional, IsInt, IsString, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FeedbackReportStatus } from '@prisma/client';

export class FilterFeedbackReportsDto {
  @ApiProperty({ description: 'Employee ID', required: false })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({ description: 'Month (1-12)', minimum: 1, maximum: 12, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiProperty({ description: 'Year', minimum: 2020, maximum: 2100, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @ApiProperty({ description: 'Report status', enum: FeedbackReportStatus, required: false })
  @IsOptional()
  @IsEnum(FeedbackReportStatus)
  status?: FeedbackReportStatus;
}

