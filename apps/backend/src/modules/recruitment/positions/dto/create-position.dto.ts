import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RecruitmentStatus } from '@prisma/client';

export class CreatePositionDto {
  @ApiProperty({
    description: 'Title of the job position',
    example: 'Senior React Engineer',
  })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the role',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Key requirements and responsibilities',
  })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({
    description: 'Status of the position',
    enum: ['Open', 'Filled', 'Cancelled'],
    default: 'Open',
  })
  @IsOptional()
  @IsEnum(['Open', 'Filled', 'Cancelled'])
  status?: 'Open' | 'Filled' | 'Cancelled';

  @ApiPropertyOptional({
    description: 'Opportunity ID to link this position to (optional)',
  })
  @IsOptional()
  @IsString()
  opportunityId?: string;

  @ApiPropertyOptional({
    description: 'Recruitment status (Headhunting or Standard)',
    enum: RecruitmentStatus,
  })
  @IsOptional()
  @IsEnum(RecruitmentStatus)
  recruitmentStatus?: RecruitmentStatus;

  @ApiPropertyOptional({
    description: 'URL to position image/logo',
    example: 'https://example.com/position-image.png',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug for the position (auto-generated from title if not provided)',
    example: 'senior-react-engineer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;
}


