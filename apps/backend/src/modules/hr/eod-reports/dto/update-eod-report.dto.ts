import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateEodReportDto } from './create-eod-report.dto';

export class UpdateEodReportDto extends PartialType(CreateEodReportDto) {
  @ApiPropertyOptional({
    description: 'Override the submitted timestamp (ADMIN/HR only)',
  })
  @IsDateString()
  @IsOptional()
  submittedAt?: string;
}


