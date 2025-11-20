import { Module } from '@nestjs/common';
import { CheckInsImportService } from './check-ins-import.service';
import { CheckInsImportController } from './check-ins-import.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CheckInsImportController],
  providers: [CheckInsImportService],
  exports: [CheckInsImportService],
})
export class CheckInsImportModule {}

