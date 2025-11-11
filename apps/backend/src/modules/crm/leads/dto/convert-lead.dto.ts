import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerSentiment, CustomerStatus, CustomerType, LeadStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class ConvertLeadDto {
  @ApiPropertyOptional({ description: 'Existing customer identifier to link the lead to' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ description: 'Customer name' })
  @IsString()
  customerName!: string;

  @ApiProperty({ description: 'Customer email' })
  @IsEmail()
  customerEmail!: string;

  @ApiPropertyOptional({ description: 'Customer phone number' })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'Customer website' })
  @IsString()
  @IsOptional()
  customerWebsite?: string;

  @ApiPropertyOptional({ description: 'Customer industry' })
  @IsString()
  @IsOptional()
  customerIndustry?: string;

  @ApiProperty({ enum: CustomerType })
  @IsEnum(CustomerType)
  customerType!: CustomerType;

  @ApiPropertyOptional({ enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  @IsEnum(CustomerStatus)
  @IsOptional()
  customerStatus?: CustomerStatus;

  @ApiPropertyOptional({ enum: CustomerSentiment, default: CustomerSentiment.HAPPY })
  @IsEnum(CustomerSentiment)
  @IsOptional()
  customerSentiment?: CustomerSentiment;

  @ApiPropertyOptional({ description: 'Monthly contract value for the new customer' })
  @IsNumber()
  @IsOptional()
  customerMonthlyValue?: number;

  @ApiPropertyOptional({ description: 'Customer currency code (ISO 4217)' })
  @IsString()
  @IsOptional()
  customerCurrency?: string;

  @ApiPropertyOptional({ description: 'Notes to store on the customer record' })
  @IsString()
  @IsOptional()
  customerNotes?: string;

  @ApiPropertyOptional({ description: 'Override lead status after conversion', enum: LeadStatus, default: LeadStatus.WON })
  @IsEnum(LeadStatus)
  @IsOptional()
  leadStatus?: LeadStatus;
}
