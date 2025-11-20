import { IsNotEmpty, IsString, IsDateString, IsInt, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class WinDto {
  @ApiProperty({ description: 'Description of the win' })
  @IsString()
  @IsNotEmpty()
  description!: string;
}

export class ChallengeDto {
  @ApiProperty({ description: 'Description of the challenge' })
  @IsString()
  @IsNotEmpty()
  challenge!: string;

  @ApiProperty({ description: 'Proposed solution' })
  @IsString()
  @IsNotEmpty()
  proposedSolution!: string;
}

export class PriorityDto {
  @ApiProperty({ description: 'Priority description' })
  @IsString()
  @IsNotEmpty()
  description!: string;
}

export class TopPerformingSourceDto {
  @ApiProperty({ description: 'Source name' })
  @IsString()
  @IsNotEmpty()
  source!: string;

  @ApiProperty({ description: 'Number of screenings' })
  @IsInt()
  @Min(0)
  count!: number;
}

export class PipelineStatusDto {
  @ApiProperty({ description: 'Role name' })
  @IsString()
  @IsNotEmpty()
  role!: string;

  @ApiProperty({ description: 'Pipeline status (e.g., "4 Active -> 4 Screened -> 2 Submitted -> 0 Final Interview")' })
  @IsString()
  @IsNotEmpty()
  pipeline!: string;

  @ApiProperty({ description: 'Confidence level (e.g., "High", "Medium", "Low")' })
  @IsString()
  @IsNotEmpty()
  confidenceLevel!: string;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateRecruiterPerformanceReportDto {
  @ApiProperty({ description: 'Position ID' })
  @IsNotEmpty()
  @IsString()
  positionId!: string;

  @ApiProperty({ description: 'Week ending date (ISO format)', example: '2025-10-24' })
  @IsDateString()
  @IsNotEmpty()
  weekEnding!: string;

  @ApiProperty({ description: 'Position title', example: 'ServiceNow Developer' })
  @IsString()
  @IsNotEmpty()
  positionTitle!: string;

  // Performance Metrics
  @ApiProperty({ description: 'Candidates contacted (actual)', minimum: 0 })
  @IsInt()
  @Min(0)
  candidatesContactedActual!: number;

  @ApiProperty({ description: 'Candidates contacted (target)', minimum: 0 })
  @IsInt()
  @Min(0)
  candidatesContactedTarget!: number;

  @ApiProperty({ description: 'Cultural calls (actual)', minimum: 0 })
  @IsInt()
  @Min(0)
  culturalCallsActual!: number;

  @ApiProperty({ description: 'Cultural calls (target)', minimum: 0 })
  @IsInt()
  @Min(0)
  culturalCallsTarget!: number;

  @ApiProperty({ description: 'Cultural calls efficiency ratio (%)', required: false })
  @IsOptional()
  culturalCallsEfficiencyRatio?: number;

  @ApiProperty({ description: 'Technical calls (actual)', minimum: 0 })
  @IsInt()
  @Min(0)
  technicalCallsActual!: number;

  @ApiProperty({ description: 'Technical calls (target)', minimum: 0 })
  @IsInt()
  @Min(0)
  technicalCallsTarget!: number;

  @ApiProperty({ description: 'Technical calls efficiency ratio (%)', required: false })
  @IsOptional()
  technicalCallsEfficiencyRatio?: number;

  @ApiProperty({ description: 'Client interviews scheduled (actual)', minimum: 0 })
  @IsInt()
  @Min(0)
  clientInterviewsScheduledActual!: number;

  @ApiProperty({ description: 'Client interviews scheduled (target)', minimum: 0 })
  @IsInt()
  @Min(0)
  clientInterviewsScheduledTarget!: number;

  @ApiProperty({ description: 'Submission to interview ratio (%)', required: false })
  @IsOptional()
  submissionToInterviewRatio?: number;

  @ApiProperty({ description: 'Placements this week', minimum: 0 })
  @IsInt()
  @Min(0)
  placementsThisWeek!: number;

  // Wins
  @ApiProperty({ description: 'Key wins and accomplishments', type: [WinDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WinDto)
  wins?: WinDto[];

  // Challenges
  @ApiProperty({ description: 'Challenges and proposed solutions', type: [ChallengeDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChallengeDto)
  challenges?: ChallengeDto[];

  // Priorities
  @ApiProperty({ description: 'S.M.A.R.T. priorities for next week', type: [PriorityDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriorityDto)
  priorities?: PriorityDto[];

  // Pipeline
  @ApiProperty({ description: 'Top performing sources', type: [TopPerformingSourceDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopPerformingSourceDto)
  topPerformingSources?: TopPerformingSourceDto[];

  @ApiProperty({ description: 'Pipeline status', type: PipelineStatusDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => PipelineStatusDto)
  pipelineStatus?: PipelineStatusDto;
}

