import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerSentiment, CustomerStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateCustomerStatusDto {
  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsEnum(CustomerStatus)
  @IsOptional()
  status?: CustomerStatus;

  @ApiPropertyOptional({ enum: CustomerSentiment })
  @IsEnum(CustomerSentiment)
  @IsOptional()
  sentiment?: CustomerSentiment;

  @ApiPropertyOptional({ description: 'Optional note explaining the change' })
  @IsString()
  @IsOptional()
  note?: string;
}


