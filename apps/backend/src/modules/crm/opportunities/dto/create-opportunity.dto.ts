import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CustomerType } from '@prisma/client';

export class CreateOpportunityDto {
  @ApiProperty({
    description: 'Lead identifier the opportunity is linked to',
  })
  @IsString()
  @IsNotEmpty()
  leadId!: string;

  @ApiPropertyOptional({
    description: 'Customer identifier if the lead is already converted',
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({
    description: 'Opportunity title or short summary',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the opportunity',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: CustomerType,
    description: 'Opportunity type (Staff Augmentation, Subscription, Both)',
  })
  @IsEnum(CustomerType)
  type!: CustomerType;

  @ApiProperty({
    description: 'Projected contract value',
    example: 15000,
  })
  @IsNumber()
  @Min(0)
  @Transform(({ value }) =>
    value === null || value === undefined || value === '' ? undefined : Number(value),
  )
  value!: number;

  @ApiPropertyOptional({
    description: 'User assigned to manage the opportunity',
  })
  @IsString()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({
    description: 'URL to detailed job description (Staff Aug opportunities)',
  })
  @IsUrl()
  @IsOptional()
  jobDescriptionUrl?: string;

  @ApiPropertyOptional({
    description: 'Current stage of the opportunity pipeline',
    example: 'Discovery',
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  stage?: string;

  @ApiPropertyOptional({
    description: 'Flag indicating whether the opportunity is closed',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value === 'true';
    }
    return undefined;
  })
  isClosed?: boolean;

  @ApiPropertyOptional({
    description: 'Flag indicating whether the opportunity was won',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value === 'true';
    }
    return undefined;
  })
  isWon?: boolean;

  @ApiPropertyOptional({
    description: 'Optional title override when creating linked open position (deprecated - use positions array)',
    example: 'Senior React Developer (US Timezone)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  positionTitle?: string;

  @ApiPropertyOptional({
    description: 'Optional detailed description for the linked open position (deprecated - use positions array)',
  })
  @IsString()
  @IsOptional()
  positionDescription?: string;

  @ApiPropertyOptional({
    description: 'Optional requirements summary for the linked open position (deprecated - use positions array)',
  })
  @IsString()
  @IsOptional()
  positionRequirements?: string;

  @ApiPropertyOptional({
    description: 'Array of positions to create for this opportunity',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Senior React Developer' },
        description: { type: 'string', example: 'Full-stack developer position' },
        requirements: { type: 'string', example: '5+ years experience, React, Node.js' },
        recruitmentStatus: { type: 'string', enum: ['HEADHUNTING', 'STANDARD'] },
      },
    },
  })
  @IsOptional()
  positions?: Array<{
    title: string;
    description?: string;
    requirements?: string;
    recruitmentStatus?: 'HEADHUNTING' | 'STANDARD';
  }>;
}


