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

export enum LeadImportField {
  TITLE = 'title',
  DESCRIPTION = 'description',
  STATUS = 'status',
  VALUE = 'value',
  PROBABILITY = 'probability',
  SOURCE = 'source',
  EXPECTED_CLOSE_DATE = 'expectedCloseDate',
  CONTACT_EMAIL = 'contactEmail',
  CONTACT_FIRST_NAME = 'contactFirstName',
  CONTACT_LAST_NAME = 'contactLastName',
  CONTACT_FULL_NAME = 'contactFullName',
  CONTACT_PHONE = 'contactPhone',
  CONTACT_ROLE = 'contactRole',
  CONTACT_COMPANY = 'contactCompany',
  CUSTOMER_NAME = 'customerName',
  OWNER_EMAIL = 'ownerEmail',
}

export class LeadFieldMappingEntry {
  @ApiProperty({
    description: 'Name of the column from the uploaded CSV file',
    example: 'lead_title',
  })
  @IsString()
  sourceColumn!: string;

  @ApiProperty({
    description: 'Target field in the division5 lead model',
    enum: LeadImportField,
    example: LeadImportField.TITLE,
  })
  @IsEnum(LeadImportField)
  targetField!: LeadImportField;
}

export class LeadMapImportDto {
  @ApiProperty({
    description: 'Field mappings between CSV columns and lead fields',
    type: [LeadFieldMappingEntry],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeadFieldMappingEntry)
  mappings!: LeadFieldMappingEntry[];

  @ApiProperty({
    description:
      'Optional columns that should be skipped even if provided in the CSV',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredColumns?: string[];
}


