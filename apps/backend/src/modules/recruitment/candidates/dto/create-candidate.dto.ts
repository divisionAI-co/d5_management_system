import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CandidateStage } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class CreateCandidateDto {
  @ApiProperty({ description: 'Candidate first name' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ description: 'Candidate last name' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: 'Candidate email address' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Current job title' })
  @IsString()
  @IsOptional()
  currentTitle?: string;

  @ApiPropertyOptional({
    description: 'Years of professional experience',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  yearsOfExperience?: number;

  @ApiPropertyOptional({
    description: 'List of skills',
    type: [String],
    example: ['React', 'Node.js'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ description: 'Resume file URL' })
  @IsUrl()
  @IsOptional()
  resume?: string;

  @ApiPropertyOptional({ description: 'LinkedIn profile URL' })
  @IsUrl()
  @IsOptional()
  linkedinUrl?: string;

  @ApiPropertyOptional({ description: 'GitHub profile URL' })
  @IsUrl()
  @IsOptional()
  githubUrl?: string;

  @ApiPropertyOptional({ description: 'Portfolio URL' })
  @IsUrl()
  @IsOptional()
  portfolioUrl?: string;

  @ApiPropertyOptional({
    enum: CandidateStage,
    default: CandidateStage.VALIDATION,
  })
  @IsEnum(CandidateStage)
  @IsOptional()
  stage?: CandidateStage;

  @ApiPropertyOptional({
    description: 'Candidate rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'City of residence' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'Country of residence' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Date when candidate is available from' })
  @IsDateString()
  @IsOptional()
  availableFrom?: string;

  @ApiPropertyOptional({
    description: 'Expected salary amount',
    example: 60000,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  expectedSalary?: number;

  @ApiPropertyOptional({
    description: 'Currency for expected salary',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  salaryCurrency?: string;

  @ApiPropertyOptional({
    description: 'Google Drive folder ID containing interviews and documents',
    example: '1A2b3C4D5E6F7G8H',
  })
  @IsString()
  @IsOptional()
  driveFolderId?: string;

  @ApiPropertyOptional({
    description: 'Google Drive folder share URL',
    example: 'https://drive.google.com/drive/folders/1A2b3C4D5E6F7G8H?usp=sharing',
  })
  @IsString()
  @IsOptional()
  driveFolderUrl?: string;

  @ApiPropertyOptional({
    description: 'Whether the candidate is active (visible in board by default). Defaults to true.',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}


