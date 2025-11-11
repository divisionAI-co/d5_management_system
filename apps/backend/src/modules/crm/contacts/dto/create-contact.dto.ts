import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, IsUrl, MaxLength } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ description: 'Contact first name' })
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ description: 'Contact last name' })
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ description: 'Primary email for the contact' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Role or title of the contact' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  role?: string;

  @ApiPropertyOptional({ description: 'Company name associated with the contact' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  companyName?: string;

  @ApiPropertyOptional({ description: 'LinkedIn profile URL' })
  @IsUrl()
  @IsOptional()
  linkedinUrl?: string;

  @ApiPropertyOptional({ description: 'Internal notes about the contact' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Customer identifier when the contact is linked to an account' })
  @IsUUID()
  @IsOptional()
  customerId?: string;
}
