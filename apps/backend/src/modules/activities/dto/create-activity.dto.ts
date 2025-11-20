import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ActivityVisibility } from '@prisma/client';

class ActivityTargetDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Customer ID to attach the activity to' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Lead ID to attach the activity to' })
  @IsUUID()
  @IsOptional()
  leadId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Opportunity ID to attach the activity to' })
  @IsUUID()
  @IsOptional()
  opportunityId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Candidate ID to attach the activity to' })
  @IsUUID()
  @IsOptional()
  candidateId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Employee ID to attach the activity to' })
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Contact ID to attach the activity to' })
  @IsUUID()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Task ID to attach the activity to' })
  @IsUUID()
  @IsOptional()
  taskId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Quote ID to attach the activity to' })
  @IsUUID()
  @IsOptional()
  quoteId?: string;
}

@ValidatorConstraint({ name: 'atLeastOneActivityTarget', async: false })
export class AtLeastOneTargetConstraint implements ValidatorConstraintInterface {
  validate(target: ActivityTargetDto) {
    if (!target) return false;
    return Object.values(target).some((value) => Boolean(value));
  }

  defaultMessage() {
    return 'At least one target (customerId, leadId, opportunityId, candidateId, employeeId, contactId, taskId, quoteId) must be provided';
  }
}

export class CreateActivityDto {
  @ApiProperty({ format: 'uuid', description: 'Activity type identifier' })
  @IsUUID()
  activityTypeId!: string;

  @ApiProperty({ description: 'Short subject or headline for the activity' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiPropertyOptional({ description: 'Detailed body or description of the activity', type: String })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional({
    description: 'Primary date/time for the activity (e.g., meeting time)',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  activityDate?: string;

  @ApiPropertyOptional({
    description: 'Reminder date/time for the activity',
    format: 'date-time',
  })
  @IsDateString()
  @ValidateIf((dto) => dto.reminderAt !== undefined)
  reminderAt?: string;

  @ApiPropertyOptional({ description: 'Assign activity to another teammate', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({
    enum: ActivityVisibility,
    default: ActivityVisibility.PUBLIC,
    description: 'Visibility of the activity',
  })
  @IsEnum(ActivityVisibility)
  @IsOptional()
  visibility?: ActivityVisibility;

  @ApiPropertyOptional({
    type: Object,
    description: 'Flexible metadata for integrations or custom attributes',
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Mark the activity as completed immediately',
  })
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @ApiPropertyOptional({
    description: 'Send notifications to assignee and mentioned users when supported',
  })
  @IsBoolean()
  @IsOptional()
  notifyAssignee?: boolean;

  @ApiProperty({
    description: 'Target entities to attach this activity to',
    type: ActivityTargetDto,
  })
  @ValidateNested()
  @Type(() => ActivityTargetDto)
  @Validate(AtLeastOneTargetConstraint)
  targets!: ActivityTargetDto;
}


