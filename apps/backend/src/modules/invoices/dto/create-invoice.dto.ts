import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';

export class InvoiceItemDto {
  @ApiProperty({ description: 'Line item description' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ description: 'Quantity of units', example: 1 })
  @IsNumber()
  @Min(0)
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? 0
      : Number(value),
  )
  quantity!: number;

  @ApiProperty({ description: 'Unit price', example: 2500 })
  @IsNumber()
  @Min(0)
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? 0
      : Number(value),
  )
  unitPrice!: number;

  @ApiPropertyOptional({
    description: 'Optional line item metadata for custom integrations',
    type: Object,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Customer identifier' })
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional({ description: 'Custom invoice number' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  invoiceNumber?: string;

  @ApiPropertyOptional({
    description: 'Issue date (defaults to current date)',
    example: '2025-01-01',
  })
  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @ApiProperty({
    description: 'Due date for payment',
    example: '2025-01-31',
  })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code (e.g., USD, EUR)',
    example: 'USD',
    default: 'USD',
  })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a valid ISO 4217 currency code (3 uppercase letters)',
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Tax rate percentage applied to subtotal',
    example: 18.5,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? 0
      : Number(value),
  )
  taxRate?: number;

  @ApiPropertyOptional({ enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Additional notes visible on invoice' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'Invoice line items',
    type: [InvoiceItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  @ApiPropertyOptional({
    description: 'Mark invoice as part of a recurring series',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'boolean' ? value : value === 'true'))
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Day of the month to generate recurring invoices (1-28)',
    minimum: 1,
    maximum: 28,
  })
  @IsInt()
  @Min(1)
  @Max(28)
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : Number(value),
  )
  recurringDay?: number;
}


