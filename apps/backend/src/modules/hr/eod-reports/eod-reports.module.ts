import { Module } from '@nestjs/common';
import { EodReportsService } from './eod-reports.service';
import { EodReportsController } from './eod-reports.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [PrismaModule, EmployeesModule],
  controllers: [EodReportsController],
  providers: [EodReportsService],
  exports: [EodReportsService],
})
export class EodReportsModule {}


