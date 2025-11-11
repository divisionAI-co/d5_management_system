import { IsString, IsNumber, IsDateString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePerformanceReviewDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty()
  @IsDateString()
  reviewPeriodStart!: string;

  @ApiProperty()
  @IsDateString()
  reviewPeriodEnd!: string;

  @ApiProperty({ type: 'object' })
  @IsObject()
  ratings!: Record<string, unknown>; // JSON object

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  strengths?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  improvements?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  goals?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  overallRating?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  reviewedAt?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reviewerName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pdfUrl?: string;
}

