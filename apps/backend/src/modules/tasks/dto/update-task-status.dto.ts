import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @ApiPropertyOptional({
    description:
      'Completion timestamp in ISO format. Defaults to now when status is DONE.',
  })
  @IsDateString()
  @IsOptional()
  completedAt?: string;
}


