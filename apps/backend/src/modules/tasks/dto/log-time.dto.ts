import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class LogTimeDto {
  @ApiProperty({
    description: 'Hours spent on the task',
    example: 1.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hours!: number;

  @ApiPropertyOptional({
    description: 'Description of work done during this time',
    example: 'Fixed bug in authentication flow',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

