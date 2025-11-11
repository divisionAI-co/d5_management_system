import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ContractType, EmploymentStatus, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';

class ConvertCandidateUserOptionsDto {
  @ApiPropertyOptional({
    description: 'Optional password for the new user account. If omitted, a secure password will be generated.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    description: 'Optional phone number for the user.',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Role to assign to the new user. Defaults to EMPLOYEE.',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class ConvertCandidateToEmployeeDto {
  @ApiPropertyOptional({
    description: 'Existing user identifier to link with the new employee. If omitted, a new user will be created from the candidate profile.',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Whether to automatically generate a secure password when creating a new user (default true).',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  autoGeneratePassword?: boolean;

  @ApiPropertyOptional({
    description: 'Optional overrides for the user that will be created from the candidate profile.',
    type: ConvertCandidateUserOptionsDto,
  })
  @ValidateIf((dto) => !dto.userId)
  @ValidateNested()
  @Type(() => ConvertCandidateUserOptionsDto)
  @IsOptional()
  user?: ConvertCandidateUserOptionsDto;

  @ApiProperty({
    description: 'Unique employee number identifier.',
  })
  @IsString()
  employeeNumber!: string;

  @ApiPropertyOptional({
    description: 'Employee department.',
  })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({
    description: 'Job title for the employee. Defaults to candidate current title.',
  })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiPropertyOptional({
    description: 'Employment status after conversion.',
    enum: EmploymentStatus,
    default: EmploymentStatus.ACTIVE,
  })
  @IsEnum(EmploymentStatus)
  @IsOptional()
  status?: EmploymentStatus;

  @ApiProperty({
    description: 'Contract type for the employee.',
    enum: ContractType,
  })
  @IsEnum(ContractType)
  contractType!: ContractType;

  @ApiProperty({
    description: 'Hire date for the employee in ISO format.',
  })
  @IsDateString()
  hireDate!: string;

  @ApiPropertyOptional({
    description: 'Termination date if known in ISO format.',
  })
  @IsDateString()
  @IsOptional()
  terminationDate?: string;

  @ApiProperty({
    description: 'Base salary for the employee.',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  salary!: number;

  @ApiPropertyOptional({
    description: 'Salary currency (defaults to USD or candidate currency).',
    default: 'USD',
  })
  @IsString()
  @IsOptional()
  salaryCurrency?: string;

  @ApiPropertyOptional({
    description: 'Manager employee identifier.',
  })
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact name.',
  })
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact phone.',
  })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({
    description: 'Relationship with the emergency contact.',
  })
  @IsString()
  @IsOptional()
  emergencyContactRelation?: string;
}


