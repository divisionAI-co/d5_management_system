import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../common/prisma/prisma.module';
import { EmployeesImportController } from './employees-import.controller';
import { EmployeesImportService } from './employees-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeesImportController],
  providers: [EmployeesImportService],
})
export class EmployeesImportModule {}
