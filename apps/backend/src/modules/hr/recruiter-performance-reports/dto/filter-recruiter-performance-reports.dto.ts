import { IsOptional, IsString, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FilterRecruiterPerformanceReportsDto {
  @ApiProperty({ description: 'Position ID filter', required: false })
  @IsOptional()
  @IsString()
  positionId?: string;

  @ApiProperty({ description: 'Recruiter ID filter', required: false })
  @IsOptional()
  @IsString()
  recruiterId?: string;

  @ApiProperty({ description: 'Week ending date from (ISO format)', required: false })
  @IsOptional()
  @IsDateString()
  weekEndingFrom?: string;

  @ApiProperty({ description: 'Week ending date to (ISO format)', required: false })
  @IsOptional()
  @IsDateString()
  weekEndingTo?: string;

  @ApiProperty({ description: 'Page number', required: false, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Page size', required: false, minimum: 1, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;
}

