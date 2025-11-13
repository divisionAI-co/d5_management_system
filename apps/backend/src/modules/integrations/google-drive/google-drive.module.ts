import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../../common/prisma/prisma.module';
import { GoogleOAuthService } from '../google-oauth.service';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveController } from './google-drive.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [GoogleOAuthService, GoogleDriveService],
  controllers: [GoogleDriveController],
  exports: [GoogleDriveService],
})
export class GoogleDriveModule {}



