import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { GoogleDriveModule } from '../../integrations/google-drive/google-drive.module';

@Module({
  imports: [PrismaModule, GoogleDriveModule, ConfigModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}

