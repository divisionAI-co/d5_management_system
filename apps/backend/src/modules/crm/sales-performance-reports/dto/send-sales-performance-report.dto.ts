import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class SendSalesPerformanceReportDto {
  @ApiPropertyOptional({
    description: 'Recipient email addresses',
    type: [String],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
    }
    return undefined;
  })
  to?: string[];

  @ApiPropertyOptional({
    description: 'CC email addresses',
    type: [String],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
    }
    return undefined;
  })
  cc?: string[];

  @ApiPropertyOptional({ description: 'Email subject line' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  subject?: string;

  @ApiPropertyOptional({
    description: 'Email body message',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description: 'Optional custom template identifier',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  templateId?: string;
}

