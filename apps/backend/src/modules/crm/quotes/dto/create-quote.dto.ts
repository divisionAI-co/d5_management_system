import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsUUID, IsEnum } from 'class-validator';
import { QuoteStatus } from '@prisma/client';

export class CreateQuoteDto {
  @ApiProperty({ description: 'Lead ID this quote belongs to' })
  @IsUUID()
  leadId!: string;

  @ApiPropertyOptional({ description: 'Opportunity ID this quote is linked to' })
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiProperty({ description: 'Quote number (auto-generated if not provided)' })
  @IsOptional()
  @IsString()
  quoteNumber?: string;

  @ApiProperty({ description: 'Quote title' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Quote description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Overview of the proposal' })
  @IsOptional()
  @IsString()
  overview?: string;

  @ApiPropertyOptional({ description: 'Functional proposal' })
  @IsOptional()
  @IsString()
  functionalProposal?: string;

  @ApiPropertyOptional({ description: 'Technical proposal' })
  @IsOptional()
  @IsString()
  technicalProposal?: string;

  @ApiPropertyOptional({ description: 'Team composition' })
  @IsOptional()
  @IsString()
  teamComposition?: string;

  @ApiPropertyOptional({ description: 'Milestones (free text with formatting)' })
  @IsOptional()
  @IsString()
  milestones?: string;

  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Warranty period (e.g., "12 months")' })
  @IsOptional()
  @IsString()
  warrantyPeriod?: string;

  @ApiPropertyOptional({ description: 'Total quote value' })
  @IsOptional()
  @IsNumber()
  totalValue?: number;

  @ApiPropertyOptional({ description: 'Currency code (default: USD)' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Quote status', enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @ApiPropertyOptional({ description: 'Template ID to use for PDF/preview generation' })
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

