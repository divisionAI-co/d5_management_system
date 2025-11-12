import { IsEnum, IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';
import { RemoteWorkFrequency } from '../../hr/remote-work/dto/update-remote-work-policy.dto';

export class UpdateCompanySettingsDto {
  @IsOptional()
  @IsEnum(RemoteWorkFrequency)
  remoteWorkFrequency?: RemoteWorkFrequency;

  @IsOptional()
  @IsInt()
  @Min(0)
  remoteWorkLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eodGraceDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  eodReportDeadlineHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  eodReportDeadlineMin?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  reviewCycleDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  annualLeaveAllowanceDays?: number;
}


