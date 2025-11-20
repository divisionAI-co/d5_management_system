import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class PreviewSalesPerformanceReportDto {
  @ApiPropertyOptional({
    description: 'Template ID to use for preview. If not provided, uses default template.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Additional data to merge with report data for template rendering',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  templateData?: Record<string, any>;
}

