import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStatus, LeadType } from '@prisma/client';

export class LeadContactInputDto {
  @ApiProperty({ description: 'Contact first name' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ description: 'Contact last name' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: 'Contact email address' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Contact role/title' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ description: 'Company name associated with the contact' })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({ description: 'Existing customer identifier to link the contact' })
  @IsUUID()
  @IsOptional()
  customerId?: string;
}

export class CreateLeadDto {
  @ApiPropertyOptional({ 
    description: 'Existing contact identifiers to attach to the lead (can provide multiple)',
    type: [String],
    example: ['contact-uuid-1', 'contact-uuid-2']
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  contactIds?: string[];

  @ApiPropertyOptional({ description: 'Legacy: Single contact identifier (use contactIds for multiple)' })
  @IsUUID()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Contact details used when no contactIds/contactId is provided', type: LeadContactInputDto })
  @ValidateNested()
  @Type(() => LeadContactInputDto)
  @IsOptional()
  contact?: LeadContactInputDto;

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

  @ApiPropertyOptional({ description: 'Probability of closing (0-100)', minimum: 0, maximum: 100 })
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

  @ApiPropertyOptional({ description: 'Prospect company name when no customer exists yet' })
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

  @ApiPropertyOptional({ 
    description: 'Lead type (End-customer or Intermediary)',
    enum: LeadType,
  })
  @IsEnum(LeadType)
  @IsOptional()
  leadType?: LeadType;
}
