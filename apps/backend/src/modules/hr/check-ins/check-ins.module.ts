import { Module } from '@nestjs/common';
import { CheckInsService } from './check-ins.service';
import { CheckInsController } from './check-ins.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [PrismaModule, EmployeesModule],
  controllers: [CheckInsController],
  providers: [CheckInsService],
  exports: [CheckInsService],
})
export class CheckInsModule {}

