import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendReportDto {
  @ApiProperty({ description: 'Customer email address to send the report to' })
  @IsNotEmpty()
  @IsEmail()
  recipientEmail!: string;

  @ApiProperty({ description: 'Additional message to include in the email', required: false })
  @IsOptional()
  @IsString()
  message?: string;
}

