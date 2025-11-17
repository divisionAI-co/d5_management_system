import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { CandidateStage } from '@prisma/client';

class ManualMatchesDto {
  @ApiPropertyOptional({
    description: 'Manual matches for recruiters: { "importedValue": "userId" }',
    example: { 'john.doe@example.com': 'uuid-here' },
  })
  @IsOptional()
  @IsObject()
  recruiters?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Manual matches for job positions: { "importedValue": "positionId" }',
    example: { 'Senior Developer': 'uuid-here' },
  })
  @IsOptional()
  @IsObject()
  positions?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Manual matches for activity types: { "importedValue": "activityTypeId" }',
    example: { 'Phone Call': 'uuid-here' },
  })
  @IsOptional()
  @IsObject()
  activityTypes?: Record<string, string>;
}

export class ExecuteCandidateImportDto {
  @ApiPropertyOptional({
    description: 'Whether to update existing candidates matched by email.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;

  @ApiPropertyOptional({
    description: 'Default stage applied when the column is missing.',
    enum: CandidateStage,
  })
  @IsOptional()
  @IsEnum(CandidateStage)
  defaultStage?: CandidateStage;

  @ApiPropertyOptional({
    description: 'Default salary currency applied when not provided (e.g. USD).',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  defaultSalaryCurrency?: string;

  @ApiPropertyOptional({
    description: 'User ID who is performing the import (for activity creation).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({
    description:
      'Enable Odoo-specific processing: extract Google Drive links from HTML notes and parse HTML fields to plain text.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isOdooImport?: boolean;

  @ApiPropertyOptional({
    description: 'Manual matches for values that could not be automatically matched.',
    type: ManualMatchesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ManualMatchesDto)
  manualMatches?: ManualMatchesDto;
}
