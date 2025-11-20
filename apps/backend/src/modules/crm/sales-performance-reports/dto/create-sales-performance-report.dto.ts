import { IsNotEmpty, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSalesPerformanceReportDto {
  @ApiProperty({ description: 'Week ending date (ISO format)', example: '2025-10-24' })
  @IsDateString()
  @IsNotEmpty()
  weekEnding!: string;

  // LinkedIn Campaigns
  @ApiProperty({ description: 'Number of LinkedIn connection requests sent', minimum: 0 })
  @IsInt()
  @Min(0)
  linkedinConnectionRequests!: number;

  @ApiProperty({ description: 'Number of LinkedIn connection requests accepted', minimum: 0 })
  @IsInt()
  @Min(0)
  linkedinAccepted!: number;

  @ApiProperty({ description: 'Number of meetings scheduled from LinkedIn', minimum: 0 })
  @IsInt()
  @Min(0)
  linkedinMeetingsScheduled!: number;

  @ApiProperty({ description: 'Number of LinkedIn accounts used', minimum: 0 })
  @IsInt()
  @Min(0)
  linkedinAccountsCount!: number;

  @ApiProperty({ description: 'Markets targeted (comma-separated or JSON)', required: false })
  @IsOptional()
  @IsString()
  linkedinMarketsTargeted?: string;

  // InMail Campaigns
  @ApiProperty({ description: 'Number of InMails sent', minimum: 0 })
  @IsInt()
  @Min(0)
  inmailSent!: number;

  @ApiProperty({ description: 'Number of InMail replies received', minimum: 0 })
  @IsInt()
  @Min(0)
  inmailReplies!: number;

  @ApiProperty({ description: 'Number of meetings scheduled from InMail', minimum: 0 })
  @IsInt()
  @Min(0)
  inmailMeetingsScheduled!: number;
}

