import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../../common/prisma/prisma.module';
import { GoogleOAuthService } from '../google-oauth.service';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleCalendarController } from './google-calendar.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [GoogleCalendarController],
  providers: [GoogleOAuthService, GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}


