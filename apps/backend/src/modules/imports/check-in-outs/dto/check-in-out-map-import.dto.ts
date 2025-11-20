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

export enum CheckInOutImportField {
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  CARD_NUMBER = 'cardNumber',
  DATE_TIME = 'dateTime',
  STATUS = 'status',
}

export class CheckInOutFieldMappingEntry {
  @ApiProperty({
    description: 'Name of the column from the uploaded spreadsheet',
    example: 'First Name',
  })
  @IsString()
  sourceColumn!: string;

  @ApiProperty({
    description: 'Target check-in/out field to map the column to',
    enum: CheckInOutImportField,
    example: CheckInOutImportField.FIRST_NAME,
  })
  @IsEnum(CheckInOutImportField)
  targetField!: CheckInOutImportField;
}

export class CheckInOutMapImportDto {
  @ApiProperty({
    description: 'Field mappings between spreadsheet columns and check-in/out fields',
    type: [CheckInOutFieldMappingEntry],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckInOutFieldMappingEntry)
  mappings!: CheckInOutFieldMappingEntry[];

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

