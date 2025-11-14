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

export enum OpportunityImportField {
  TITLE = 'title',
  DESCRIPTION = 'description',
  TYPE = 'type',
  VALUE = 'value',
  STAGE = 'stage',
  CUSTOMER_NAME = 'customerName',
  CUSTOMER_EMAIL = 'customerEmail',
  CONTACT_EMAIL = 'contactEmail',
  CONTACT_FIRST_NAME = 'contactFirstName',
  CONTACT_LAST_NAME = 'contactLastName',
  CONTACT_FULL_NAME = 'contactFullName',
  CONTACT_PHONE = 'contactPhone',
  LEAD_TITLE = 'leadTitle',
  LEAD_DESCRIPTION = 'leadDescription',
  LEAD_STATUS = 'leadStatus',
  OWNER_EMAIL = 'ownerEmail',
  JOB_DESCRIPTION_URL = 'jobDescriptionUrl',
  NOTES = 'notes',
  IS_CLOSED = 'isClosed',
  IS_WON = 'isWon',
}

export class OpportunityFieldMappingEntry {
  @ApiProperty({
    description: 'Name of the column from the uploaded spreadsheet',
    example: 'Opportunity Title',
  })
  @IsString()
  sourceColumn!: string;

  @ApiProperty({
    description: 'Target opportunity field to map the column to',
    enum: OpportunityImportField,
    example: OpportunityImportField.TITLE,
  })
  @IsEnum(OpportunityImportField)
  targetField!: OpportunityImportField;
}

export class OpportunityMapImportDto {
  @ApiProperty({
    description: 'Field mappings between spreadsheet columns and opportunity fields',
    type: [OpportunityFieldMappingEntry],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OpportunityFieldMappingEntry)
  mappings!: OpportunityFieldMappingEntry[];

  @ApiProperty({
    description: 'Optional columns that should be ignored even if present in the spreadsheet',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredColumns?: string[];
}


