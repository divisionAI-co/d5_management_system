import { Module } from '@nestjs/common';
import { CheckInOutsService } from './check-in-outs.service';
import { CheckInOutsController } from './check-in-outs.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CheckInOutsController],
  providers: [CheckInOutsService],
  exports: [CheckInOutsService],
})
export class CheckInOutsModule {}

