import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class OpenRemoteWindowDto {
  @ApiProperty({
    description: 'ISO date representing the first day of the remote work window (inclusive)',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    required: false,
    description:
      'ISO date representing the last day of the remote work window (inclusive). Defaults to 6 days after start date.',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

