import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AiActionsController } from './ai-actions.controller';
import { AiActionsService } from './ai-actions.service';
import { AiActionExecutor } from './ai-action-executor.service';
import { EntityFieldResolver } from './entity-field-resolver.service';
import { GeminiService } from './gemini.service';
import { CollectionFieldResolver } from './collection-field-resolver.service';

@Module({
  imports: [ConfigModule, PrismaModule, ActivitiesModule],
  controllers: [AiActionsController],
  providers: [
    AiActionsService,
    AiActionExecutor,
    EntityFieldResolver,
    GeminiService,
    CollectionFieldResolver,
  ],
  exports: [AiActionsService, AiActionExecutor],
})
export class AiActionsModule {}


