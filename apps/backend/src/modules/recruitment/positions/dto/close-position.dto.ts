import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ClosePositionDto {
  @ApiPropertyOptional({
    description: 'Date when the position was filled',
  })
  @IsDateString()
  @IsOptional()
  filledAt?: string;

  @ApiPropertyOptional({
    description: 'Optional note about closing the position',
  })
  @IsString()
  @IsOptional()
  note?: string;
}


