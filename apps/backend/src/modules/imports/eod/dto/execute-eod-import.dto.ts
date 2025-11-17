import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ManualMatchesDto {
  @ApiPropertyOptional({
    description: 'Manual matches for employees: { "importedEmail": "userId" }',
    example: { 'john.doe@example.com': 'uuid-here' },
  })
  @IsOptional()
  @IsObject()
  employees?: Record<string, string>;
}

export class ExecuteEodImportDto {
  @ApiPropertyOptional({
    description: 'Whether existing reports should be updated when a matching date is found.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;

  @ApiPropertyOptional({
    description:
      'If true, reports without a submitted timestamp will be marked as submitted at the time of import.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  markMissingAsSubmitted?: boolean;

  @ApiPropertyOptional({
    description: 'Default late flag applied when the column is missing.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  defaultIsLate?: boolean;

  @ApiPropertyOptional({
    description:
      'Enable this when importing the legacy Google Form export so the importer aggregates tasks per email/day and matches users approximately.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  useLegacyFormat?: boolean;

  @ApiPropertyOptional({
    description: 'Manual matches for values that could not be automatically matched.',
    type: ManualMatchesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ManualMatchesDto)
  manualMatches?: ManualMatchesDto;
}
