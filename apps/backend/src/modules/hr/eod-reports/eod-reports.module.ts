import { Module } from '@nestjs/common';
import { EodReportsService } from './eod-reports.service';
import { EodReportsController } from './eod-reports.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { EmployeesModule } from '../employees/employees.module';
import { TemplatesModule } from '../../templates/templates.module';
import { EmailModule } from '../../../common/email/email.module';

@Module({
  imports: [PrismaModule, EmployeesModule, TemplatesModule, EmailModule],
  controllers: [EodReportsController],
  providers: [EodReportsService],
  exports: [EodReportsService],
})
export class EodReportsModule {}


