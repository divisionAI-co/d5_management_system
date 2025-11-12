import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../common/prisma/prisma.module';
import { LeadsImportController } from './leads-import.controller';
import { LeadsImportService } from './leads-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [LeadsImportController],
  providers: [LeadsImportService],
})
export class LeadsImportModule {}


