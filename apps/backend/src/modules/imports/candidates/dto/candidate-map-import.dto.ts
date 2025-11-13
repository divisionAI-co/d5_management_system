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

export enum CandidateImportField {
  EMAIL = 'email',
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  FULL_NAME = 'fullName',
  PHONE = 'phone',
  CITY = 'city',
  COUNTRY = 'country',
  CURRENT_TITLE = 'currentTitle',
  YEARS_OF_EXPERIENCE = 'yearsOfExperience',
  SKILLS = 'skills',
  RESUME_URL = 'resumeUrl',
  LINKEDIN_URL = 'linkedinUrl',
  GITHUB_URL = 'githubUrl',
  PORTFOLIO_URL = 'portfolioUrl',
  STAGE = 'stage',
  RATING = 'rating',
  NOTES = 'notes',
  AVAILABLE_FROM = 'availableFrom',
  EXPECTED_SALARY = 'expectedSalary',
  SALARY_CURRENCY = 'salaryCurrency',
  IS_ACTIVE = 'isActive',
  ODOO_ID = 'odooId',
  ACTIVITIES = 'activities',
}

export class CandidateFieldMappingEntry {
  @ApiProperty({
    description: 'Name of the column from the uploaded spreadsheet',
    example: 'Candidate Email',
  })
  @IsString()
  sourceColumn!: string;

  @ApiProperty({
    description: 'Target candidate field to map the column to',
    enum: CandidateImportField,
    example: CandidateImportField.EMAIL,
  })
  @IsEnum(CandidateImportField)
  targetField!: CandidateImportField;
}

export class CandidateMapImportDto {
  @ApiProperty({
    description: 'Field mappings between spreadsheet columns and candidate fields',
    type: [CandidateFieldMappingEntry],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CandidateFieldMappingEntry)
  mappings!: CandidateFieldMappingEntry[];

  @ApiProperty({
    description:
      'Optional columns that should be ignored even if present in the spreadsheet',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredColumns?: string[];
}
