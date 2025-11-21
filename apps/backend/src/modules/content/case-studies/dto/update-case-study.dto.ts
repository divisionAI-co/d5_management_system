import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, IsDateString, IsObject } from 'class-validator';
import { CaseStudyStatus } from '@prisma/client';

export class UpdateCaseStudyDto {
  @ApiPropertyOptional({
    description: 'Title of the case study',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Short excerpt/summary of the case study',
  })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Full content of the case study',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'URL to featured image',
  })
  @IsOptional()
  @IsString()
  featuredImage?: string;

  @ApiPropertyOptional({
    description: 'Status of the case study',
    enum: CaseStudyStatus,
  })
  @IsOptional()
  @IsEnum(CaseStudyStatus)
  status?: CaseStudyStatus;

  @ApiPropertyOptional({
    description: 'Publication date (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional({
    description: 'Client name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientName?: string;

  @ApiPropertyOptional({
    description: 'URL to client logo',
  })
  @IsOptional()
  @IsString()
  clientLogo?: string;

  @ApiPropertyOptional({
    description: 'Industry',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({
    description: 'Project date (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  projectDate?: string;

  @ApiPropertyOptional({
    description: 'The challenge the customer faced',
  })
  @IsOptional()
  @IsString()
  challenge?: string;

  @ApiPropertyOptional({
    description: 'The solution provided',
  })
  @IsOptional()
  @IsString()
  solution?: string;

  @ApiPropertyOptional({
    description: 'Information about the customer',
  })
  @IsOptional()
  @IsString()
  aboutCustomer?: string;

  @ApiPropertyOptional({
    description: 'Results/metrics (JSON object)',
  })
  @IsOptional()
  @IsObject()
  results?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'SEO meta title',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'SEO meta description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;
}

