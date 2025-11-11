import { Module } from '@nestjs/common';

import { CompanySettingsController } from './company-settings.controller';
import { CompanySettingsService } from './company-settings.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  controllers: [CompanySettingsController, IntegrationsController],
  providers: [CompanySettingsService, IntegrationsService],
  exports: [CompanySettingsService, IntegrationsService],
})
export class SettingsModule {}


