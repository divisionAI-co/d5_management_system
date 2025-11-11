import { Module } from '@nestjs/common';
import { PerformanceReviewsService } from './performance-reviews.service';
import { PerformanceReviewsController } from './performance-reviews.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { PdfModule } from '../../../common/pdf/pdf.module';

@Module({
  imports: [PrismaModule, PdfModule],
  controllers: [PerformanceReviewsController],
  providers: [PerformanceReviewsService],
  exports: [PerformanceReviewsService],
})
export class PerformanceReviewsModule {}

