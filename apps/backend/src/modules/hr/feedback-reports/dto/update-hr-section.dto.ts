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

  @ApiProperty({ description: 'HR feedback text', required: false })
  @IsOptional()
  @IsString()
  hrFeedback?: string;

  @ApiProperty({ description: 'Description of action taken by HR', required: false })
  @IsOptional()
  @IsString()
  hrActionDescription?: string;
}

