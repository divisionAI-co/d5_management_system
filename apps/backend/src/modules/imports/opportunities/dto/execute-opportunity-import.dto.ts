import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ManualMatchesDto {
  @ApiPropertyOptional({
    description: 'Manual matches for customers: { "importedValue": "customerId" }',
    example: { 'Acme Corp': 'uuid-here' },
  })
  @IsOptional()
  @IsObject()
  customers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Manual matches for owners: { "importedValue": "userId" }',
    example: { 'owner@example.com': 'uuid-here' },
  })
  @IsOptional()
  @IsObject()
  owners?: Record<string, string>;
}

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

  @ApiPropertyOptional({
    description: 'Manual matches for values that could not be automatically matched.',
    type: ManualMatchesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ManualMatchesDto)
  manualMatches?: ManualMatchesDto;
}


