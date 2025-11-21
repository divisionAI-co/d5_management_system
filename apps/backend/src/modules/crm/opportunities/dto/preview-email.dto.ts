import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewOpportunityEmailDto {
  @ApiPropertyOptional({
    description: 'Template ID to use for preview',
  })
  @IsString()
  @IsOptional()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Custom HTML content for preview',
  })
  @IsString()
  @IsOptional()
  htmlContent?: string;

  @ApiPropertyOptional({
    description: 'Custom text content for preview',
  })
  @IsString()
  @IsOptional()
  textContent?: string;
}

