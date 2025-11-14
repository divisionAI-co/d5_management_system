import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../common/prisma/prisma.module';
import { OpportunitiesImportController } from './opportunities-import.controller';
import { OpportunitiesImportService } from './opportunities-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [OpportunitiesImportController],
  providers: [OpportunitiesImportService],
  exports: [OpportunitiesImportService],
})
export class OpportunitiesImportModule {}


