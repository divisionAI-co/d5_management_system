import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendRecruiterPerformanceReportDto {
  @ApiProperty({ description: 'Recipient email address' })
  @IsNotEmpty()
  @IsEmail()
  recipientEmail!: string;

  @ApiProperty({ description: 'Optional message to include in the email', required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ description: 'Template ID to use for the report', required: false })
  @IsOptional()
  @IsString()
  templateId?: string;
}

