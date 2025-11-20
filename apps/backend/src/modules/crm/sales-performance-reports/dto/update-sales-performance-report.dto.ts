import { PartialType } from '@nestjs/swagger';
import { CreateSalesPerformanceReportDto } from './create-sales-performance-report.dto';

export class UpdateSalesPerformanceReportDto extends PartialType(CreateSalesPerformanceReportDto) {}

