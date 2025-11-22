import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, IsDateString, IsBoolean } from 'class-validator';
import { BlogStatus } from '@prisma/client';

export class UpdateBlogDto {
  @ApiPropertyOptional({
    description: 'Title of the blog post',
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
    description: 'Short excerpt/summary of the blog post',
  })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Full content of the blog post',
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
    description: 'Whether this blog post is featured',
  })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({
    description: 'Status of the blog post',
    enum: BlogStatus,
  })
  @IsOptional()
  @IsEnum(BlogStatus)
  status?: BlogStatus;

  @ApiPropertyOptional({
    description: 'Publication date (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

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

