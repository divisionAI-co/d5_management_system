import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateRemoteWorkLogDto {
  @ApiPropertyOptional({
    description: 'Employee ID when logging on behalf of another employee (HR/Admin only)',
  })
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({
    description: 'Date of the remote work day in ISO format',
    example: '2025-11-11',
  })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    description: 'Optional reason or notes for the remote work day',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}


