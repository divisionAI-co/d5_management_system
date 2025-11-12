import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { CandidateStage } from '@prisma/client';

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
}
