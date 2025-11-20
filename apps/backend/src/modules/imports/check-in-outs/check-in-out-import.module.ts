import { Module } from '@nestjs/common';
import { CheckInOutImportService } from './check-in-out-import.service';
import { CheckInOutImportController } from './check-in-out-import.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CheckInOutImportController],
  providers: [CheckInOutImportService],
  exports: [CheckInOutImportService],
})
export class CheckInOutImportModule {}

