import { Module } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { EmailModule } from '../../../common/email/email.module';
import { TemplatesModule } from '../../templates/templates.module';

@Module({
  imports: [PrismaModule, EmailModule, TemplatesModule],
  controllers: [CandidatesController],
  providers: [CandidatesService],
  exports: [CandidatesService],
})
export class CandidatesModule {}


