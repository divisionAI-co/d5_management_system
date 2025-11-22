import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, IsDateString, IsBoolean } from 'class-validator';
import { BlogStatus } from '@prisma/client';

export class CreateBlogDto {
  @ApiProperty({
    description: 'Title of the blog post',
    example: '10 Tips for Better Project Management',
  })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug (auto-generated from title if not provided)',
    example: '10-tips-for-better-project-management',
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

  @ApiProperty({
    description: 'Full content of the blog post (HTML or markdown)',
  })
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    description: 'URL to featured image',
  })
  @IsOptional()
  @IsString()
  featuredImage?: string;

  @ApiPropertyOptional({
    description: 'Whether this blog post is featured',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({
    description: 'Status of the blog post',
    enum: BlogStatus,
    default: BlogStatus.DRAFT,
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

