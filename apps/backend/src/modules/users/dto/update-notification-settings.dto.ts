import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ description: 'Enable email notifications', default: true })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable in-app notifications', default: true })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Notify when a task is assigned', default: true })
  @IsOptional()
  @IsBoolean()
  taskAssigned?: boolean;

  @ApiPropertyOptional({ description: 'Notify when a task is due soon', default: true })
  @IsOptional()
  @IsBoolean()
  taskDueSoon?: boolean;

  @ApiPropertyOptional({ description: 'Notify when a leave request is approved', default: true })
  @IsOptional()
  @IsBoolean()
  leaveApproved?: boolean;

  @ApiPropertyOptional({
    description: 'Notify about performance review updates',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  performanceReview?: boolean;

  @ApiPropertyOptional({ description: 'Notify about new candidates', default: true })
  @IsOptional()
  @IsBoolean()
  newCandidate?: boolean;

  @ApiPropertyOptional({ description: 'Notify about new opportunities', default: true })
  @IsOptional()
  @IsBoolean()
  newOpportunity?: boolean;
}

