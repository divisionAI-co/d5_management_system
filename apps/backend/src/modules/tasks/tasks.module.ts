import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksSchedulerService } from './tasks-scheduler.service';

@Module({
  imports: [PrismaModule, NotificationsModule, UsersModule],
  controllers: [TasksController],
  providers: [TasksService, TasksSchedulerService],
  exports: [TasksService],
})
export class TasksModule {}


