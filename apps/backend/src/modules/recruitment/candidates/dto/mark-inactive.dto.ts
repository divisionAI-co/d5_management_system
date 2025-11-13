import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class MarkInactiveDto {
  @ApiPropertyOptional({
    description: 'Reason for marking the candidate as inactive',
    example: 'Position filled',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Whether to send an email notification to the candidate',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Email template ID to use. If not provided, a custom email can be sent.',
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.sendEmail === true)
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Custom email subject (required if sendEmail is true and no templateId)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  @ValidateIf((o) => o.sendEmail === true && !o.templateId)
  emailSubject?: string;

  @ApiPropertyOptional({
    description: 'Custom email body (required if sendEmail is true and no templateId)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  @ValidateIf((o) => o.sendEmail === true && !o.templateId)
  emailBody?: string;

  @ApiPropertyOptional({
    description: 'Recipient email address. Defaults to candidate email if not provided.',
  })
  @IsEmail()
  @IsOptional()
  @ValidateIf((o) => o.sendEmail === true)
  emailTo?: string;
}

