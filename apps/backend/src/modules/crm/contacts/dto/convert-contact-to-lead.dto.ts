import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { LeadStatus } from '@prisma/client';

export class ConvertContactToLeadDto {
  @ApiProperty({ description: 'Lead title or headline' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Lead description or notes' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: LeadStatus, default: LeadStatus.NEW })
  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;

  @ApiPropertyOptional({ description: 'Potential deal value' })
  @IsNumber()
  @IsOptional()
  value?: number;

  @ApiPropertyOptional({
    description: 'Probability of closing (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  probability?: number;

  @ApiPropertyOptional({ description: 'Assigned salesperson identifier' })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Lead source (e.g. Website, Referral)' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ description: 'Expected close date (ISO 8601)' })
  @IsString()
  @IsOptional()
  expectedCloseDate?: string;

  @ApiPropertyOptional({
    description: 'Prospect company name when no customer exists yet',
  })
  @IsString()
  @IsOptional()
  prospectCompanyName?: string;

  @ApiPropertyOptional({ description: 'Prospect company website' })
  @IsString()
  @IsOptional()
  prospectWebsite?: string;

  @ApiPropertyOptional({ description: 'Prospect industry' })
  @IsString()
  @IsOptional()
  prospectIndustry?: string;
}


