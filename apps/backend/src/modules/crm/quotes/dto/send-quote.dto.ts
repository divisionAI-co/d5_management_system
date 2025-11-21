import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';

export class SendQuoteDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'customer@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  to!: string;

  @ApiProperty({
    description: 'Email subject',
    example: 'Quote: Project Proposal - Q-2024-001',
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

