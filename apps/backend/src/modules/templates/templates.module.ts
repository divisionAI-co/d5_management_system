import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EmailModule } from '../../common/email/email.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { EmailTemplateConfigService } from './email-template-config.service';
import { EmailTemplateConfigController } from './email-template-config.controller';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [TemplatesController, EmailTemplateConfigController],
  providers: [TemplatesService, EmailTemplateConfigService],
  exports: [TemplatesService, EmailTemplateConfigService],
})
export class TemplatesModule {}


