import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum InvoiceImportField {
  INVOICE_NUMBER = 'invoiceNumber',
  CUSTOMER_EMAIL = 'customerEmail',
  CUSTOMER_NAME = 'customerName',
  ISSUE_DATE = 'issueDate',
  DUE_DATE = 'dueDate',
  PAID_DATE = 'paidDate',
  STATUS = 'status',
  SUBTOTAL = 'subtotal',
  TAX_RATE = 'taxRate',
  TAX_AMOUNT = 'taxAmount',
  TOTAL = 'total',
  CURRENCY = 'currency',
  NOTES = 'notes',
  ITEMS = 'items',
  // Individual line item fields
  ITEM_DESCRIPTION = 'itemDescription',
  ITEM_QUANTITY = 'itemQuantity',
  ITEM_UNIT_PRICE = 'itemUnitPrice',
  ITEM_UOM = 'itemUom',
  ITEM_ACCOUNT = 'itemAccount',
  ITEM_TAXES = 'itemTaxes',
  ITEM_AMOUNT = 'itemAmount',
  // Other fields
  IS_RECURRING = 'isRecurring',
  RECURRING_DAY = 'recurringDay',
  CREATED_BY_EMAIL = 'createdByEmail',
  PDF_URL = 'pdfUrl',
}

export class InvoiceFieldMappingEntry {
  @ApiProperty({
    description: 'Name of the column from the uploaded spreadsheet',
    example: 'Invoice Number',
  })
  @IsString()
  sourceColumn!: string;

  @ApiProperty({
    description: 'Target invoice field to map the column to',
    enum: InvoiceImportField,
    example: InvoiceImportField.INVOICE_NUMBER,
  })
  @IsEnum(InvoiceImportField)
  targetField!: InvoiceImportField;
}

export class InvoiceMapImportDto {
  @ApiProperty({
    description: 'Field mappings between spreadsheet columns and invoice fields',
    type: [InvoiceFieldMappingEntry],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceFieldMappingEntry)
  mappings!: InvoiceFieldMappingEntry[];

  @ApiProperty({
    description:
      'Optional columns that should be skipped even if present in the spreadsheet',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredColumns?: string[];
}
