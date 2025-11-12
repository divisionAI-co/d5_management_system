import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EodImportField {
  EMAIL = 'email',
  DATE = 'date',
  SUMMARY = 'summary',
  TASKS = 'tasks',
  HOURS_WORKED = 'hoursWorked',
  SUBMITTED_AT = 'submittedAt',
  IS_LATE = 'isLate',
}

export class EodFieldMappingEntry {
  @ApiProperty({
    description: 'Name of the column from the uploaded spreadsheet',
    example: 'Employee Email',
  })
  @IsString()
  sourceColumn!: string;

  @ApiProperty({
    description: 'Target EOD field to map the column to',
    enum: EodImportField,
    example: EodImportField.EMAIL,
  })
  @IsEnum(EodImportField)
  targetField!: EodImportField;
}

export class EodMapImportDto {
  @ApiProperty({
    description: 'Field mappings between spreadsheet columns and EOD fields',
    type: [EodFieldMappingEntry],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EodFieldMappingEntry)
  mappings!: EodFieldMappingEntry[];

  @ApiProperty({
    description:
      'Optional columns that should be skipped even if present in the spreadsheet',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredColumns?: string[];
}
