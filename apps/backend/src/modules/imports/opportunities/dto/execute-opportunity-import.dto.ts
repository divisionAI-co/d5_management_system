import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ExecuteOpportunityImportDto {
  @ApiPropertyOptional({
    description: 'If true, existing opportunities matched by lead and title will be updated',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;

  @ApiPropertyOptional({
    description: 'Default owner email used when the column is missing',
    example: 'sales@division5.com',
  })
  @IsOptional()
  @IsString()
  defaultOwnerEmail?: string;

  @ApiPropertyOptional({
    description: 'Default customer identifier to link when not provided in the file',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  defaultCustomerId?: string;

  @ApiPropertyOptional({
    description: 'Default pipeline stage to apply when the column is empty',
    example: 'Qualification',
  })
  @IsOptional()
  @IsString()
  defaultStage?: string;
}


