import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ValidateIf,
  IsObject,
} from 'class-validator';
import { ActivityVisibility } from '@prisma/client';
import { Type } from 'class-transformer';

class UpdateTargetsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  customerId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  leadId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  opportunityId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  candidateId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  employeeId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  contactId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  taskId?: string | null;
}

export class UpdateActivityDto {
  @ApiPropertyOptional({ description: 'Override activity type' })
  @IsUUID()
  @IsOptional()
  activityTypeId?: string;

  @ApiPropertyOptional({ description: 'Updated subject' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Updated body content' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  body?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsDateString()
  activityDate?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsDateString()
  reminderAt?: string | null;

  @ApiPropertyOptional({ description: 'Toggle pinned state' })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: 'Toggle completion state' })
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'Assign to user' })
  @IsUUID()
  @IsOptional()
  assignedToId?: string | null;

  @ApiPropertyOptional({ enum: ActivityVisibility })
  @IsEnum(ActivityVisibility)
  @IsOptional()
  visibility?: ActivityVisibility;

  @ApiPropertyOptional({ type: UpdateTargetsDto })
  @ValidateNested()
  @Type(() => UpdateTargetsDto)
  @IsOptional()
  targets?: UpdateTargetsDto;

  @ApiPropertyOptional({ type: Object })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsObject()
  metadata?: Record<string, unknown> | null;
}


