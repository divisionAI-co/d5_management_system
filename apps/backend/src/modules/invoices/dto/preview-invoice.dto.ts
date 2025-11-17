import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class PreviewInvoiceDto {
  @ApiPropertyOptional({
    description: 'Template ID to use for preview. If not provided, uses default invoice template.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Additional data to merge with invoice data for template rendering',
    type: Object,
    example: {
      customMessage: 'Thank you for your business!',
      footerNote: 'Payment due within 30 days',
    },
  })
  @IsOptional()
  @IsObject()
  templateData?: Record<string, any>;
}

