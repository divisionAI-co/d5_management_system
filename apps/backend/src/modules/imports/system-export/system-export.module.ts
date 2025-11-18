import { Module } from '@nestjs/common';
import { SystemExportController } from './system-export.controller';
import { SystemExportService } from './system-export.service';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SystemExportController],
  providers: [SystemExportService],
  exports: [SystemExportService],
})
export class SystemExportModule {}

