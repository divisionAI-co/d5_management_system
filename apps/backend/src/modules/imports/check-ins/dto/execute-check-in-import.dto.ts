import { IsBoolean, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ManualMatchesDto {
  @ApiPropertyOptional({
    description: 'Manual matches for employees: { "cardNumber": "employeeId" } or { "firstName lastName": "employeeId" }',
    example: { '12345': 'uuid-here', 'John Doe': 'uuid-here' },
  })
  @IsOptional()
  @IsObject()
  employees?: Record<string, string>;
}

export class ExecuteCheckInImportDto {
  @ApiPropertyOptional({ description: 'Whether to update existing records', default: false })
  @IsBoolean()
  @IsOptional()
  updateExisting?: boolean = false;

  @ApiPropertyOptional({
    description: 'Manual matches for employees that could not be automatically matched.',
    type: ManualMatchesDto,
  })
  @IsOptional()
  @IsObject()
  manualMatches?: ManualMatchesDto;
}

