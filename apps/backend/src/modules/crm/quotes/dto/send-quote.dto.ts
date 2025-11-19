import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class SendQuoteDto {
  @ApiProperty({ description: 'Recipient email address' })
  @IsEmail()
  to!: string;

  @ApiPropertyOptional({ description: 'Email subject (uses template default if not provided)' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Email message body (uses template default if not provided)' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'CC email addresses' })
  @IsOptional()
  @IsString()
  cc?: string;

  @ApiPropertyOptional({ description: 'BCC email addresses' })
  @IsOptional()
  @IsString()
  bcc?: string;
}

