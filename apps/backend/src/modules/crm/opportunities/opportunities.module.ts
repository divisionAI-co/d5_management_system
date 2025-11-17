import { Module } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesController } from './opportunities.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { EmailModule } from '../../../common/email/email.module';
import { TemplatesModule } from '../../templates/templates.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [PrismaModule, EmailModule, TemplatesModule, NotificationsModule, UsersModule],
  providers: [OpportunitiesService],
  controllers: [OpportunitiesController],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}


