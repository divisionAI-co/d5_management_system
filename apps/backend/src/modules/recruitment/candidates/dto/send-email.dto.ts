import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendCandidateEmailDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'candidate@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  to!: string;

  @ApiProperty({
    description: 'Email subject',
    example: 'Interview Update',
  })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiPropertyOptional({
    description: 'Template ID to use for the email. If not provided, custom email will be sent.',
  })
  @IsUUID()
  @IsOptional()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Custom HTML content. Required if templateId is not provided.',
  })
  @IsString()
  @IsOptional()
  htmlContent?: string;

  @ApiPropertyOptional({
    description: 'Custom text content. Optional fallback for plain text emails.',
  })
  @IsString()
  @IsOptional()
  textContent?: string;

  @ApiPropertyOptional({
    description: 'CC recipients (comma-separated emails)',
  })
  @IsString()
  @IsOptional()
  cc?: string;

  @ApiPropertyOptional({
    description: 'BCC recipients (comma-separated emails)',
  })
  @IsString()
  @IsOptional()
  bcc?: string;
}

