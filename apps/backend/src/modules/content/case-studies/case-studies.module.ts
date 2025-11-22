import { Module } from '@nestjs/common';
import { CaseStudiesService } from './case-studies.service';
import { CaseStudiesController } from './case-studies.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { StorageModule } from '../../../common/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [CaseStudiesController],
  providers: [CaseStudiesService],
  exports: [CaseStudiesService],
})
export class CaseStudiesModule {}

