import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ImportSystemDto {
  @ApiProperty({
    description: 'If true, clears all existing data before importing',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  clearExisting?: boolean = false;
}

