import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  IsOptional,
  IsNumber,
  IsString,
  IsDateString,
  IsEnum,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EodTaskLifecycle {
  NEW = 'NEW',
  RETURNED = 'RETURNED',
}

export enum EodTaskWorkType {
  PLANNING = 'PLANNING',
  RESEARCH = 'RESEARCH',
  IMPLEMENTATION = 'IMPLEMENTATION',
  TESTING = 'TESTING',
}

export enum EodTaskStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export class EodReportTaskDto {
  @ApiProperty({ description: 'Client or project details for the task' })
  @IsString()
  clientDetails!: string;

  @ApiProperty({ description: 'Ticket or task identifier' })
  @IsString()
  ticket!: string;

  @ApiProperty({ enum: EodTaskWorkType })
  @IsEnum(EodTaskWorkType)
  typeOfWorkDone!: EodTaskWorkType;

  @ApiPropertyOptional({ description: 'Estimated time for the task (hours)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  taskEstimatedTime?: number;

  @ApiProperty({ description: 'Time spent on the task today (hours)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  timeSpentOnTicket!: number;

  @ApiProperty({ enum: EodTaskLifecycle })
  @IsEnum(EodTaskLifecycle)
  taskLifecycle!: EodTaskLifecycle;

  @ApiProperty({ enum: EodTaskStatus })
  @IsEnum(EodTaskStatus)
  taskStatus!: EodTaskStatus;
}

export class CreateEodReportDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsString()
  summary!: string;

  @ApiProperty({
    type: [EodReportTaskDto],
    description: 'Tasks completed as part of the report',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EodReportTaskDto)
  tasks!: EodReportTaskDto[];

  @ApiPropertyOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  hoursWorked?: number;

  @ApiPropertyOptional({
    description: 'Set to true to submit the report immediately after saving.',
  })
  @IsBoolean()
  @IsOptional()
  submit?: boolean;
}


