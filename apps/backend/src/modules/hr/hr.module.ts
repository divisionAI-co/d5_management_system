import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module';
import { PerformanceReviewsModule } from './performance-reviews/performance-reviews.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { HolidaysModule } from './holidays/holidays.module';
import { EodReportsModule } from './eod-reports/eod-reports.module';
import { RemoteWorkModule } from './remote-work/remote-work.module';
import { FeedbackReportsModule } from './feedback-reports/feedback-reports.module';

@Module({
  imports: [
    EmployeesModule,
    PerformanceReviewsModule,
    LeaveRequestsModule,
    HolidaysModule,
    EodReportsModule,
    RemoteWorkModule,
    FeedbackReportsModule,
  ],
  exports: [
    EmployeesModule,
    PerformanceReviewsModule,
    LeaveRequestsModule,
    HolidaysModule,
    EodReportsModule,
    RemoteWorkModule,
    FeedbackReportsModule,
  ],
})
export class HrModule {}

