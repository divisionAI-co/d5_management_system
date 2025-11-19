import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TaskPriority, TaskStatus } from '@prisma/client';

// Note: TaskRecurrenceType will be available from @prisma/client after running `prisma generate`
// For now, using an enum here for validation
export enum TaskRecurrenceType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class CreateTaskTemplateDto {
  @ApiProperty({ description: 'Task title' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ description: 'Detailed task description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({
    description: 'Recurrence type',
    enum: TaskRecurrenceType,
  })
  @IsEnum(TaskRecurrenceType)
  recurrenceType!: TaskRecurrenceType;

  @ApiPropertyOptional({
    description: 'Recurrence interval (e.g., every 2 weeks = 2)',
    default: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  recurrenceInterval?: number;

  @ApiPropertyOptional({
    description: 'Whether the template is active (generates tasks)',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value !== false) // Default to true if not specified
  isActive?: boolean;

  @ApiProperty({ description: 'Start date for recurrence in ISO format' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ description: 'End date for recurrence in ISO format (null = no end)' })
  @IsDateString()
  @IsOptional()
  endDate?: string | null;

  @ApiPropertyOptional({
    description: 'User IDs of default assignees for generated tasks',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  defaultAssigneeIds?: string[];

  @ApiPropertyOptional({
    description: 'Related customer ID for generated tasks',
  })
  @IsUUID()
  @IsOptional()
  defaultCustomerId?: string;

  @ApiPropertyOptional({
    description: 'Default tags for generated tasks',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    return [];
  })
  defaultTags?: string[];

  @ApiPropertyOptional({
    description: 'Default estimated hours for generated tasks',
    example: 5.5,
  })
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : Number(value),
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  defaultEstimatedHours?: number;

  @ApiProperty({
    description: 'User ID of the template creator',
  })
  @IsUUID()
  createdById!: string;
}

