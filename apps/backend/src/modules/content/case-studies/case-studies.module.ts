import { Module } from '@nestjs/common';
import { CaseStudiesService } from './case-studies.service';
import { CaseStudiesController } from './case-studies.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CaseStudiesController],
  providers: [CaseStudiesService],
  exports: [CaseStudiesService],
})
export class CaseStudiesModule {}

