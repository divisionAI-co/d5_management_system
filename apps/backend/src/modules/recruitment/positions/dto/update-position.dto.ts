import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

const STATUS_OPTIONS = ['Open', 'Filled', 'Cancelled'] as const;
type PositionStatus = (typeof STATUS_OPTIONS)[number];

export class UpdatePositionDto {
  @ApiPropertyOptional({
    description: 'Position title override',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Detailed position description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Role requirements',
  })
  @IsString()
  @IsOptional()
  requirements?: string;

  @ApiPropertyOptional({
    description: 'Status of the position',
    enum: STATUS_OPTIONS,
  })
  @IsString()
  @IsOptional()
  status?: PositionStatus;
}


