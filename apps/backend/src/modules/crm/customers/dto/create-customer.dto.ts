import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CustomerSentiment, CustomerStatus, CustomerType } from '@prisma/client';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Customer name' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Primary email address' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Company website URL' })
  @IsUrl()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ description: 'Industry or sector' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  industry?: string;

  @ApiProperty({ enum: CustomerType, description: 'Customer business model' })
  @IsEnum(CustomerType)
  type!: CustomerType;

  @ApiPropertyOptional({ enum: CustomerStatus, default: CustomerStatus.ONBOARDING })
  @IsEnum(CustomerStatus)
  @IsOptional()
  status?: CustomerStatus;

  @ApiPropertyOptional({ enum: CustomerSentiment, default: CustomerSentiment.NEUTRAL })
  @IsEnum(CustomerSentiment)
  @IsOptional()
  sentiment?: CustomerSentiment;

  @ApiPropertyOptional({ description: 'Street address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Postal or ZIP code' })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Tax identification number' })
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiPropertyOptional({ description: 'Company registration identifier' })
  @IsString()
  @IsOptional()
  registrationId?: string;

  @ApiPropertyOptional({ description: 'Monthly contract value', example: 2500 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined || value === '' ? undefined : Number(value)))
  monthlyValue?: number;

  @ApiPropertyOptional({ description: 'Currency code (ISO 4217)', example: 'USD' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ description: 'Internal notes', maxLength: 5000 })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Tags used for segmentation',
    type: [String],
    example: ['enterprise', 'priority'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    return [];
  })
  tags?: string[];

  @ApiPropertyOptional({ description: 'External Odoo identifier' })
  @IsString()
  @IsOptional()
  odooId?: string;

  @ApiPropertyOptional({
    description: 'Google Drive folder ID containing contracts and documents',
    example: '1A2b3C4D5E6F7G8H',
  })
  @IsString()
  @IsOptional()
  driveFolderId?: string;

  @ApiPropertyOptional({
    description: 'Google Drive folder URL (alternative to driveFolderId)',
    example: 'https://drive.google.com/drive/folders/1A2b3C4D5E6F7G8H',
  })
  @IsString()
  @IsOptional()
  driveFolderUrl?: string;
}


