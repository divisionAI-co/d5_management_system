import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsObject } from 'class-validator';

export class ExecuteCheckInOutImportDto {
  @ApiPropertyOptional({
    description: 'Whether to update existing records if they already exist',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  updateExisting?: boolean;

  @ApiPropertyOptional({
    description: 'Manual matches for unmatched employees (key: import identifier, value: employeeId)',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsObject()
  @IsOptional()
  manualMatches?: {
    employees?: Record<string, string>;
  };
}

