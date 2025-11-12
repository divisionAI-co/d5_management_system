import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../common/prisma/prisma.module';
import { CandidatesImportService } from './candidates-import.service';
import { CandidatesImportController } from './candidates-import.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CandidatesImportController],
  providers: [CandidatesImportService],
})
export class CandidatesImportModule {}
