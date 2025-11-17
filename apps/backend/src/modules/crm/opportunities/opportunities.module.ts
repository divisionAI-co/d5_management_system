import { Module } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesController } from './opportunities.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { EmailModule } from '../../../common/email/email.module';
import { TemplatesModule } from '../../templates/templates.module';

@Module({
  imports: [PrismaModule, EmailModule, TemplatesModule],
  providers: [OpportunitiesService],
  controllers: [OpportunitiesController],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}


