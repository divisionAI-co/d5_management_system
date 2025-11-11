import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class PreviewTemplateDto {
  @ApiPropertyOptional({
    description: 'Sample data used to render the template preview',
    type: Object,
    example: {
      firstName: 'Jane',
      lastName: 'Doe',
      invoiceNumber: 'INV-2025-001',
      dueDate: '2025-12-13',
    },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}


