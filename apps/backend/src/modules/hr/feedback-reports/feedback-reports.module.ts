import { Module } from '@nestjs/common';
import { FeedbackReportsController } from './feedback-reports.controller';
import { FeedbackReportsService } from './feedback-reports.service';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { PdfModule } from '../../../common/pdf/pdf.module';
import { EmailModule } from '../../../common/email/email.module';

@Module({
  imports: [PrismaModule, PdfModule, EmailModule],
  controllers: [FeedbackReportsController],
  providers: [FeedbackReportsService],
  exports: [FeedbackReportsService],
})
export class FeedbackReportsModule {}

