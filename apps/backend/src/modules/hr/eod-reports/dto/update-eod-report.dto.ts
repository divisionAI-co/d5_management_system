import { PartialType } from '@nestjs/swagger';
import { CreateEodReportDto } from './create-eod-report.dto';

export class UpdateEodReportDto extends PartialType(CreateEodReportDto) {}


