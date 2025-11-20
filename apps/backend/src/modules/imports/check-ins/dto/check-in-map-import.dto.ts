import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum CheckInImportField {
  DATE = 'DATE',
  TIME = 'TIME',
  DATETIME = 'DATETIME', // Combined date and time in one column
  FIRST_NAME = 'FIRST_NAME',
  LAST_NAME = 'LAST_NAME',
  EMPLOYEE_CARD_NUMBER = 'EMPLOYEE_CARD_NUMBER',
  STATUS = 'STATUS',
}

export class CheckInFieldMappingEntry {
  @ApiProperty({ description: 'Source column name from the uploaded file' })
  @IsString()
  sourceColumn!: string;

  @ApiProperty({ enum: CheckInImportField, description: 'Target field to map to' })
  @IsEnum(CheckInImportField)
  targetField!: CheckInImportField;
}

export class CheckInMapImportDto {
  @ApiProperty({ type: [CheckInFieldMappingEntry], description: 'Field mappings' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckInFieldMappingEntry)
  mappings!: CheckInFieldMappingEntry[];

  @ApiProperty({ type: [String], required: false, description: 'Columns to ignore' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredColumns?: string[];
}

