import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const SORTABLE_FIELDS = ['issueDate', 'dueDate', 'total', 'invoiceNumber', 'createdAt', 'status'];

export class FilterInvoicesDto {
  @ApiPropertyOptional({ description: 'Search by invoice number or customer name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Filter by customer identifier' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Only return recurring invoices' })
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
  isRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Include only invoices overdue as of today' })
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
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Filter invoices issued on or after this date' })
  @IsDateString()
  @IsOptional()
  issueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter invoices issued on or before this date' })
  @IsDateString()
  @IsOptional()
  issueDateTo?: string;

  @ApiPropertyOptional({ description: 'Filter invoices due on or after this date' })
  @IsDateString()
  @IsOptional()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter invoices due on or before this date' })
  @IsDateString()
  @IsOptional()
  dueDateTo?: string;

  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 25 })
  @Transform(({ value }) => (value ? Number(value) : 25))
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: SORTABLE_FIELDS,
    default: 'issueDate',
  })
  @IsString()
  @IsOptional()
  sortBy: string = 'issueDate';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @Transform(({ value }) => (value === 'asc' ? 'asc' : 'desc'))
  sortOrder: 'asc' | 'desc' = 'desc';
}


