import { IsString, IsOptional, IsEnum, IsDateString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType, EmploymentStatus } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  candidateId?: string;

  @ApiProperty()
  @IsString()
  employeeNumber!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty()
  @IsString()
  jobTitle!: string;

  @ApiPropertyOptional({ enum: EmploymentStatus, default: EmploymentStatus.ACTIVE })
  @IsEnum(EmploymentStatus)
  @IsOptional()
  status?: EmploymentStatus;

  @ApiProperty({ enum: ContractType })
  @IsEnum(ContractType)
  contractType!: ContractType;

  @ApiProperty()
  @IsDateString()
  hireDate!: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  terminationDate?: string;

  @ApiProperty()
  @IsNumber()
  salary!: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsString()
  @IsOptional()
  salaryCurrency?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  emergencyContactRelation?: string;
}

