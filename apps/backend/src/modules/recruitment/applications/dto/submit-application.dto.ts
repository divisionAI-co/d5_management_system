import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsDateString,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum ReferralSource {
  WEBSITE = 'Website',
  LINKEDIN = 'LinkedIn',
  REFERRAL = 'Referral',
  JOB_BOARD = 'Job Board',
  SOCIAL_MEDIA = 'Social Media',
  OTHER = 'Other',
}

export class SubmitApplicationDto {
  @ApiProperty({ description: 'Candidate first name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ description: 'Candidate last name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ description: 'Candidate email address' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Position ID to apply for' })
  @IsUUID()
  @IsOptional()
  positionId?: string;

  @ApiPropertyOptional({ 
    description: 'Availability date (when candidate can start)',
    example: '2024-02-01',
  })
  @IsDateString()
  @IsOptional()
  @Transform(({ value }) => value || undefined)
  availability?: string;

  @ApiPropertyOptional({ 
    description: 'Expected net salary (after taxes)',
    example: 5000,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => value ? Number(value) : undefined)
  expectedNetSalary?: number;

  @ApiPropertyOptional({ 
    description: 'Where the candidate heard about us',
    enum: ReferralSource,
    example: ReferralSource.WEBSITE,
  })
  @IsEnum(ReferralSource)
  @IsOptional()
  referralSource?: ReferralSource;
}

