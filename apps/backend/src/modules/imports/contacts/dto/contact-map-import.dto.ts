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

export enum ContactImportField {
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  FULL_NAME = 'fullName',
  EMAIL = 'email',
  PHONE = 'phone',
  ROLE = 'role',
  COMPANY_NAME = 'companyName',
  LINKEDIN_URL = 'linkedinUrl',
  NOTES = 'notes',
  CUSTOMER_NAME = 'customerName',
}

export class ContactFieldMappingEntry {
  @ApiProperty({
    description: 'Name of the column from the uploaded CSV file',
    example: 'contact_email',
  })
  @IsString()
  sourceColumn!: string;

  @ApiProperty({
    description: 'Target field in the D5 contact model',
    enum: ContactImportField,
    example: ContactImportField.EMAIL,
  })
  @IsEnum(ContactImportField)
  targetField!: ContactImportField;
}

export class ContactMapImportDto {
  @ApiProperty({
    description: 'Field mappings between CSV columns and contact fields',
    type: [ContactFieldMappingEntry],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ContactFieldMappingEntry)
  mappings!: ContactFieldMappingEntry[];

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


