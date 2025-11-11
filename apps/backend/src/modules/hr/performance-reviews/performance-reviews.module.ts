import { Module } from '@nestjs/common';
import { PerformanceReviewsService } from './performance-reviews.service';
import { PerformanceReviewsController } from './performance-reviews.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { PdfModule } from '../../../common/pdf/pdf.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [PrismaModule, PdfModule, EmployeesModule],
  controllers: [PerformanceReviewsController],
  providers: [PerformanceReviewsService],
  exports: [PerformanceReviewsService],
})
export class PerformanceReviewsModule {}

