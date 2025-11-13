import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../common/prisma/prisma.module';
import { EodImportService } from './eod-import.service';
import { EodImportController } from './eod-import.controller';
import { LegacyEodImportService } from './legacy-eod-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [EodImportController],
  providers: [EodImportService, LegacyEodImportService],
})
export class EodImportModule {}
