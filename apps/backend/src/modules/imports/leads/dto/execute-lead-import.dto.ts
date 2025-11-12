import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { LeadStatus } from '@prisma/client';

export class ExecuteLeadImportDto {
  @ApiPropertyOptional({
    description: 'If true, existing leads matched by title+contact will be updated',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;

  @ApiPropertyOptional({
    description: 'Default owner email when not provided in the file',
  })
  @IsOptional()
  @IsString()
  defaultOwnerEmail?: string;

  @ApiPropertyOptional({
    description: 'Default status if not provided (must be a valid lead status)',
    enum: LeadStatus,
  })
  @IsOptional()
  @IsEnum(LeadStatus)
  defaultStatus?: LeadStatus;
}


