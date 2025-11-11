import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  IsDateString,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: '+355691234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.png',
    description: 'URL pointing to the profile avatar image',
  })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '1990-05-20',
    description: 'ISO 8601 date string',
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ example: 'new-email@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Current password is required when changing the password',
    example: 'CurrentPass123!',
    minLength: 8,
  })
  @ValidateIf((dto) => dto.currentPassword !== undefined)
  @IsString()
  @MinLength(8)
  @IsOptional()
  currentPassword?: string;

  @ApiPropertyOptional({
    description: 'Provide a new password to change login credentials',
    example: 'NewPass123!',
    minLength: 8,
  })
  @ValidateIf((dto) => dto.newPassword !== undefined)
  @IsString()
  @MinLength(8)
  @IsOptional()
  newPassword?: string;
}


