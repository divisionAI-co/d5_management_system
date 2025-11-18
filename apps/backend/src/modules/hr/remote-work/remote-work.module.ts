import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { EmployeesModule } from '../employees/employees.module';
import { RemoteWorkService } from './remote-work.service';
import { RemoteWorkController } from './remote-work.controller';

@Module({
  imports: [PrismaModule, EmployeesModule],
  providers: [RemoteWorkService],
  controllers: [RemoteWorkController],
  exports: [RemoteWorkService],
})
export class RemoteWorkModule {}


