import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { InvoiceStatus } from '@prisma/client';

export class ExecuteInvoiceImportDto {
  @ApiPropertyOptional({
    description: 'Whether to update existing invoices matched by invoice number.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;

  @ApiPropertyOptional({
    description: 'Default status applied when the column is missing.',
    enum: InvoiceStatus,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  defaultStatus?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'Default currency code applied when the column is missing (e.g. USD).',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({
    description: 'Fallback customer email when mapping does not provide one.',
  })
  @IsOptional()
  @IsString()
  defaultCustomerEmail?: string;

  @ApiPropertyOptional({
    description: 'Fallback customer name when email is not provided.',
  })
  @IsOptional()
  @IsString()
  defaultCustomerName?: string;

  @ApiPropertyOptional({
    description: 'Email of the user to assign as invoice creator when not provided.',
  })
  @IsOptional()
  @IsString()
  defaultCreatedByEmail?: string;

  @ApiPropertyOptional({
    description:
      'Enable Odoo-specific processing: handle multiple invoices in one file where each invoice has multiple rows (header + line items), separated by empty rows.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isOdooImport?: boolean;
}
