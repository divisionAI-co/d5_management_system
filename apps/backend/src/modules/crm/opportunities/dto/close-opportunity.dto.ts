import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CloseOpportunityDto {
  @ApiProperty({
    description: 'Indicates whether the opportunity was won (true) or lost (false)',
  })
  @IsBoolean()
  isWon!: boolean;

  @ApiPropertyOptional({
    description: 'Pipeline stage to set when closing the opportunity',
    example: 'Closed Won',
  })
  @IsString()
  @IsOptional()
  stage?: string;

  @ApiPropertyOptional({
    description: 'Optional timestamp to record when the opportunity was closed',
  })
  @IsDateString()
  @IsOptional()
  closedAt?: string;
}


