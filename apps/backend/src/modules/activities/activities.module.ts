import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AtLeastOneTargetConstraint } from './dto/create-activity.dto';

@Module({
  imports: [PrismaModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, AtLeastOneTargetConstraint],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}


