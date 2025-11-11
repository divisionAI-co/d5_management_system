import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum RemoteWorkFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export class UpdateRemoteWorkPolicyDto {
  @ApiPropertyOptional({
    enum: RemoteWorkFrequency,
    description: 'Frequency period used to evaluate remote work limits',
  })
  @IsEnum(RemoteWorkFrequency)
  @IsOptional()
  frequency?: RemoteWorkFrequency;

  @ApiPropertyOptional({
    description: 'Number of remote work days allowed within the configured frequency period',
    minimum: 1,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}


