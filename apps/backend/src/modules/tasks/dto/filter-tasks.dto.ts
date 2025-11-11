import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterTasksDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Filter by assignee user ID' })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Filter by creator user ID' })
  @IsUUID()
  @IsOptional()
  createdById?: string;

  @ApiPropertyOptional({ description: 'Filter by related customer ID' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Search text for title or description',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Return tasks due before this date' })
  @IsDateString()
  @IsOptional()
  dueBefore?: string;

  @ApiPropertyOptional({ description: 'Return tasks due after this date' })
  @IsDateString()
  @IsOptional()
  dueAfter?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of tasks to return (default 200)',
    example: 100,
  })
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : Number(value),
  )
  @IsNumber()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}


