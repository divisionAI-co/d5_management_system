import { IsOptional, IsString, IsDateString, IsInt, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateRecruiterPerformanceReportDto, WinDto, ChallengeDto, PriorityDto, TopPerformingSourceDto, PipelineStatusDto } from './create-recruiter-performance-report.dto';

export class UpdateRecruiterPerformanceReportDto {
  @ApiProperty({ description: 'Week ending date (ISO format)', required: false })
  @IsOptional()
  @IsDateString()
  weekEnding?: string;

  @ApiProperty({ description: 'Position title', required: false })
  @IsOptional()
  @IsString()
  positionTitle?: string;

  // Performance Metrics
  @ApiProperty({ description: 'Candidates contacted (actual)', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  candidatesContactedActual?: number;

  @ApiProperty({ description: 'Candidates contacted (target)', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  candidatesContactedTarget?: number;

  @ApiProperty({ description: 'Cultural calls (actual)', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  culturalCallsActual?: number;

  @ApiProperty({ description: 'Cultural calls (target)', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  culturalCallsTarget?: number;

  @ApiProperty({ description: 'Cultural calls efficiency ratio (%)', required: false })
  @IsOptional()
  culturalCallsEfficiencyRatio?: number;

  @ApiProperty({ description: 'Technical calls (actual)', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  technicalCallsActual?: number;

  @ApiProperty({ description: 'Technical calls (target)', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  technicalCallsTarget?: number;

  @ApiProperty({ description: 'Technical calls efficiency ratio (%)', required: false })
  @IsOptional()
  technicalCallsEfficiencyRatio?: number;

  @ApiProperty({ description: 'Client interviews scheduled (actual)', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  clientInterviewsScheduledActual?: number;

  @ApiProperty({ description: 'Client interviews scheduled (target)', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  clientInterviewsScheduledTarget?: number;

  @ApiProperty({ description: 'Submission to interview ratio (%)', required: false })
  @IsOptional()
  submissionToInterviewRatio?: number;

  @ApiProperty({ description: 'Placements this week', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  placementsThisWeek?: number;

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

