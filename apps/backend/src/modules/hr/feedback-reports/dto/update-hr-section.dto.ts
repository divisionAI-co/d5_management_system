import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateHrSectionDto {
  @ApiProperty({ description: 'Number of tasks employee worked on', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  tasksCount?: number;

  @ApiProperty({ description: 'Total days off taken in the month', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalDaysOffTaken?: number;

  @ApiProperty({ description: 'Total remaining days off', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalRemainingDaysOff?: number;
}

