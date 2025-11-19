import { Module } from '@nestjs/common';

import { CompanySettingsController } from './company-settings.controller';
import { CompanySettingsService } from './company-settings.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { DataCleanupController } from './data-cleanup.controller';
import { DataCleanupService } from './data-cleanup.service';

@Module({
  controllers: [
    CompanySettingsController,
    IntegrationsController,
    DataCleanupController,
  ],
  providers: [
    CompanySettingsService,
    IntegrationsService,
    DataCleanupService,
  ],
  exports: [CompanySettingsService, IntegrationsService, DataCleanupService],
})
export class SettingsModule {}


