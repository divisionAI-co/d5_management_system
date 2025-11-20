import { Module } from '@nestjs/common';
import { SalesPerformanceReportsController } from './sales-performance-reports.controller';
import { SalesPerformanceReportsService } from './sales-performance-reports.service';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { PdfModule } from '../../../common/pdf/pdf.module';
import { TemplatesModule } from '../../templates/templates.module';
import { EmailModule } from '../../../common/email/email.module';

@Module({
  imports: [PrismaModule, PdfModule, TemplatesModule, EmailModule],
  controllers: [SalesPerformanceReportsController],
  providers: [SalesPerformanceReportsService],
  exports: [SalesPerformanceReportsService],
})
export class SalesPerformanceReportsModule {}

