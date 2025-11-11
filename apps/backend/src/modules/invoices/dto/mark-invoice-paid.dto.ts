import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkInvoicePaidDto {
  @ApiPropertyOptional({
    description: 'Date when payment was received',
    example: '2025-01-15',
  })
  @IsDateString()
  @IsOptional()
  paidDate?: string;

  @ApiPropertyOptional({
    description: 'Optional transaction reference or notes about the payment',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}


