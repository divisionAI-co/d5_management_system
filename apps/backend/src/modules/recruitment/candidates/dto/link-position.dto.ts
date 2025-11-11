import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LinkCandidatePositionDto {
  @ApiProperty({
    description: 'Identifier of the position to link the candidate to',
  })
  @IsString()
  @IsNotEmpty()
  positionId!: string;

  @ApiPropertyOptional({
    description: 'Optional date when the candidate applied to the position',
  })
  @IsDateString()
  @IsOptional()
  appliedAt?: string;

  @ApiPropertyOptional({
    description: 'Status of the candidate for the position',
    example: 'Under Review',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Internal notes about the application',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}


