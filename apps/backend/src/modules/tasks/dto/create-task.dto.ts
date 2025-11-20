import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class CreateTaskDto {
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
    description: 'User ID of the task creator',
  })
  @IsUUID()
  createdById!: string;

  @ApiPropertyOptional({
    description: 'User ID of the assignee (legacy - single assignee, deprecated)',
  })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({
    description: 'User IDs of assignees (can be multiple)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  assignedToIds?: string[];

  @ApiPropertyOptional({
    description: 'Related customer ID',
  })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Task due date in ISO format' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Task start date in ISO format' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Estimated hours to complete the task',
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
  estimatedHours?: number;

  @ApiPropertyOptional({
    description: 'Actual hours spent on the task',
    example: 3.75,
  })
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : Number(value),
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  actualHours?: number;

  @ApiPropertyOptional({
    description: 'Tags associated with the task',
    type: [String],
    example: ['frontend', 'high-priority'],
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
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Parent task ID (for hierarchical task structure)',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Task IDs that block this task (those tasks must be done before this task can start)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  blockedByTaskIds?: string[];

  @ApiPropertyOptional({
    description: 'Task IDs that are related to this task (for reference, not dependency)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  relatedTaskIds?: string[];
}


