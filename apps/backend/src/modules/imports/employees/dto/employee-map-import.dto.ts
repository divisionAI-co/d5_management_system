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

export enum EmployeeImportField {
  EMAIL = 'email',
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  FULL_NAME = 'fullName',
  EMPLOYEE_NUMBER = 'employeeNumber',
  JOB_TITLE = 'jobTitle',
  DEPARTMENT = 'department',
  STATUS = 'status',
  CONTRACT_TYPE = 'contractType',
  HIRE_DATE = 'hireDate',
  TERMINATION_DATE = 'terminationDate',
  SALARY = 'salary',
  SALARY_CURRENCY = 'salaryCurrency',
  PHONE = 'phone',
  ROLE = 'role',
  MANAGER_EMAIL = 'managerEmail',
  EMERGENCY_CONTACT_NAME = 'emergencyContactName',
  EMERGENCY_CONTACT_PHONE = 'emergencyContactPhone',
  EMERGENCY_CONTACT_RELATION = 'emergencyContactRelation',
}

export class EmployeeFieldMappingEntry {
  @ApiProperty({
    description: 'Name of the column from the uploaded CSV file',
    example: 'Work Email',
  })
  @IsString()
  sourceColumn!: string;

  @ApiProperty({
    description: 'Target field in the employee import model',
    enum: EmployeeImportField,
    example: EmployeeImportField.EMAIL,
  })
  @IsEnum(EmployeeImportField)
  targetField!: EmployeeImportField;
}

export class EmployeeMapImportDto {
  @ApiProperty({
    description: 'Field mappings between CSV columns and employee fields',
    type: [EmployeeFieldMappingEntry],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EmployeeFieldMappingEntry)
  mappings!: EmployeeFieldMappingEntry[];

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
