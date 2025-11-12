import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ContractType, EmploymentStatus, UserRole } from '@prisma/client';

export class ExecuteEmployeeImportDto {
  @ApiPropertyOptional({
    description:
      'Whether to update existing employees matched by email. Defaults to true.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;

  @ApiPropertyOptional({
    description: 'Default user role to assign when creating a new user.',
    enum: UserRole,
    default: UserRole.EMPLOYEE,
  })
  @IsOptional()
  @IsEnum(UserRole)
  defaultRole?: UserRole;

  @ApiPropertyOptional({
    description: 'Default employment status when not provided in the CSV.',
    enum: EmploymentStatus,
  })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  defaultStatus?: EmploymentStatus;

  @ApiPropertyOptional({
    description: 'Default contract type when not provided in the CSV.',
    enum: ContractType,
  })
  @IsOptional()
  @IsEnum(ContractType)
  defaultContractType?: ContractType;

  @ApiPropertyOptional({
    description:
      'Email address of the manager to assign when not provided in the CSV.',
  })
  @IsOptional()
  @IsString()
  defaultManagerEmail?: string;

  @ApiPropertyOptional({
    description:
      'Default salary currency applied when not present in the CSV (defaults to USD).',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  defaultSalaryCurrency?: string;

  @ApiPropertyOptional({
    description:
      'Optional password to assign to newly created users (hashed before saving). When omitted, a secure random password is generated.',
  })
  @IsOptional()
  @IsString()
  defaultPassword?: string;
}
