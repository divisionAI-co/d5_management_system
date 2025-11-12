import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../common/prisma/prisma.module';
import { EodImportService } from './eod-import.service';
import { EodImportController } from './eod-import.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EodImportController],
  providers: [EodImportService],
})
export class EodImportModule {}
