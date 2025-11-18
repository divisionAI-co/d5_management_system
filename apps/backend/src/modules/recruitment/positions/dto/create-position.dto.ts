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
}


