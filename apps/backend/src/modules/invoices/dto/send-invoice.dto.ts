import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class SendInvoiceDto {
  @ApiPropertyOptional({
    description: 'Recipient email addresses. Defaults to customer billing email if omitted.',
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
    description: 'Email body message to include above invoice summary',
    default: 'Please find attached invoice for the recent services rendered.',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description: 'Optional custom template identifier to render invoice email',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  templateId?: string;

  @ValidateIf((o) => !!o.templateId)
  @ApiPropertyOptional({
    description: 'Template variables for the email template',
    type: Object,
  })
  @IsOptional()
  templateData?: Record<string, any>;
}


