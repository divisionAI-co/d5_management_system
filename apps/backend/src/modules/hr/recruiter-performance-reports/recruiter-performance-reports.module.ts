import { Module } from '@nestjs/common';
import { RecruiterPerformanceReportsController } from './recruiter-performance-reports.controller';
import { RecruiterPerformanceReportsService } from './recruiter-performance-reports.service';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { PdfModule } from '../../../common/pdf/pdf.module';
import { TemplatesModule } from '../../templates/templates.module';
import { EmailModule } from '../../../common/email/email.module';

@Module({
  imports: [PrismaModule, PdfModule, TemplatesModule, EmailModule],
  controllers: [RecruiterPerformanceReportsController],
  providers: [RecruiterPerformanceReportsService],
  exports: [RecruiterPerformanceReportsService],
})
export class RecruiterPerformanceReportsModule {}

