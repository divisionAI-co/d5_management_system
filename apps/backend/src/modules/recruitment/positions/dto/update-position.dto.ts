import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RecruitmentStatus } from '@prisma/client';

const STATUS_OPTIONS = ['Open', 'Filled', 'Cancelled'] as const;
type PositionStatus = (typeof STATUS_OPTIONS)[number];

export class UpdatePositionDto {
  @ApiPropertyOptional({
    description: 'Position title override',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Detailed position description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Role requirements',
  })
  @IsString()
  @IsOptional()
  requirements?: string;

  @ApiPropertyOptional({
    description: 'Status of the position',
    enum: STATUS_OPTIONS,
  })
  @IsString()
  @IsOptional()
  status?: PositionStatus;

  @ApiPropertyOptional({
    description: 'Opportunity ID to link this position to (set to null to unlink)',
  })
  @IsOptional()
  @IsString()
  opportunityId?: string | null;

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
    description: 'URL-friendly slug for the position (auto-generated from title if title changes)',
    example: 'senior-react-engineer',
  })
  @IsOptional()
  @IsString()
  slug?: string;
}


