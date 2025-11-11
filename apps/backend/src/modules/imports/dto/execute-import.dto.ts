import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ExecuteImportDto {
  @ApiPropertyOptional({
    description: 'If true, existing contacts matched by email will be updated',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;

  @ApiPropertyOptional({
    description:
      'Fallback customer ID to associate when mappings do not supply a customer',
  })
  @IsOptional()
  @IsString()
  defaultCustomerId?: string;
}


