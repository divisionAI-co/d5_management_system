import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveController } from './google-drive.controller';

@Module({
  imports: [ConfigModule],
  providers: [GoogleDriveService],
  controllers: [GoogleDriveController],
  exports: [GoogleDriveService],
})
export class GoogleDriveModule {}



