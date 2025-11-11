import { ApiProperty } from '@nestjs/swagger';
import { CandidateStage } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateCandidateStageDto {
  @ApiProperty({
    enum: CandidateStage,
    description: 'New stage for the candidate',
  })
  @IsEnum(CandidateStage)
  stage!: CandidateStage;

  @ApiProperty({
    description: 'Optional note explaining the stage change',
    required: false,
  })
  @IsString()
  @IsOptional()
  note?: string;
}


