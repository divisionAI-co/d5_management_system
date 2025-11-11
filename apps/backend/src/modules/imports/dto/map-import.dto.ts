import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
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

export enum LeadImportField {
  TITLE = 'title',
  DESCRIPTION = 'description',
  STATUS = 'status',
  VALUE = 'value',
  PROBABILITY = 'probability',
  SOURCE = 'source',
  EXPECTED_CLOSE_DATE = 'expectedCloseDate',
  ASSIGNED_TO_EMAIL = 'assignedToEmail',
  CONTACT_EMAIL = 'contactEmail',
  CONTACT_FIRST_NAME = 'contactFirstName',
  CONTACT_LAST_NAME = 'contactLastName',
  CONTACT_FULL_NAME = 'contactFullName',
  CONTACT_PHONE = 'contactPhone',
  CONTACT_ROLE = 'contactRole',
  CONTACT_COMPANY_NAME = 'contactCompanyName',
  CONTACT_LINKEDIN_URL = 'contactLinkedinUrl',
  CONTACT_NOTES = 'contactNotes',
  CUSTOMER_NAME = 'customerName',
}

export enum OpportunityImportField {
  OPPORTUNITY_TITLE = 'opportunityTitle',
  OPPORTUNITY_DESCRIPTION = 'opportunityDescription',
  OPPORTUNITY_VALUE = 'opportunityValue',
  OPPORTUNITY_TYPE = 'opportunityType',
  OPPORTUNITY_STAGE = 'opportunityStage',
  OPPORTUNITY_IS_WON = 'opportunityIsWon',
  OPPORTUNITY_IS_CLOSED = 'opportunityIsClosed',
  OPPORTUNITY_ASSIGNED_TO_EMAIL = 'opportunityAssignedToEmail',
  OPPORTUNITY_JOB_DESCRIPTION_URL = 'opportunityJobDescriptionUrl',
  CUSTOMER_NAME = 'customerName',
  LEAD_TITLE = 'leadTitle',
  LEAD_DESCRIPTION = 'leadDescription',
  LEAD_STATUS = 'leadStatus',
  LEAD_VALUE = 'leadValue',
  LEAD_PROBABILITY = 'leadProbability',
  LEAD_SOURCE = 'leadSource',
  LEAD_EXPECTED_CLOSE_DATE = 'leadExpectedCloseDate',
  LEAD_ASSIGNED_TO_EMAIL = 'leadAssignedToEmail',
  CONTACT_EMAIL = 'contactEmail',
  CONTACT_FIRST_NAME = 'contactFirstName',
  CONTACT_LAST_NAME = 'contactLastName',
  CONTACT_FULL_NAME = 'contactFullName',
  CONTACT_PHONE = 'contactPhone',
  CONTACT_ROLE = 'contactRole',
  CONTACT_COMPANY_NAME = 'contactCompanyName',
  CONTACT_LINKEDIN_URL = 'contactLinkedinUrl',
  CONTACT_NOTES = 'contactNotes',
}

export const SUPPORTED_MAPPING_FIELDS = [
  ...Object.values(ContactImportField),
  ...Object.values(LeadImportField),
  ...Object.values(OpportunityImportField),
];

export class FieldMappingEntry {
  @ApiProperty({
    description: 'Name of the column from the uploaded CSV file',
    example: 'contact_email',
  })
  @IsString()
  sourceColumn!: string;

  @ApiProperty({
    description: 'Target field in the D5 contact model',
    enum: SUPPORTED_MAPPING_FIELDS,
    example: ContactImportField.EMAIL,
  })
  @IsString()
  @IsIn(SUPPORTED_MAPPING_FIELDS)
  targetField!: string;
}

export class MapImportDto {
  @ApiProperty({
    description: 'Field mappings between CSV columns and CRM fields',
    type: [FieldMappingEntry],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FieldMappingEntry)
  mappings!: FieldMappingEntry[];

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


