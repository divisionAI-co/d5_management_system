import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EmailModule } from '../../common/email/email.module';
import { GoogleDriveProxyController } from './google-drive-proxy.controller';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [TemplatesController, GoogleDriveProxyController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}


