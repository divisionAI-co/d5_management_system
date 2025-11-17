import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { configValidationSchema } from './common/config/config.schema';

// Core modules
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SettingsModule } from './modules/settings/settings.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

// CRM modules
import { CustomersModule } from './modules/crm/customers/customers.module';
import { ContactsModule } from './modules/crm/contacts/contacts.module';
import { LeadsModule } from './modules/crm/leads/leads.module';
import { OpportunitiesModule } from './modules/crm/opportunities/opportunities.module';
// import { CampaignsModule } from './modules/crm/campaigns/campaigns.module';

// Finance
import { InvoicesModule } from './modules/invoices/invoices.module';

// Recruitment
import { CandidatesModule } from './modules/recruitment/candidates/candidates.module';
import { OpenPositionsModule } from './modules/recruitment/positions/positions.module';

// HR & Employees
import { HrModule } from './modules/hr/hr.module';
// import { EodReportsModule } from './modules/employees/eod-reports/eod-reports.module';

// Task Management
import { TasksModule } from './modules/tasks/tasks.module';

// Universal
import { ActivitiesModule } from './modules/activities/activities.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
// import { MeetingsModule } from './modules/meetings/meetings.module';
// import { ReportsModule } from './modules/reports/reports.module';
import { TemplatesModule } from './modules/templates/templates.module';

// Integrations & Imports
import { ImportsModule } from './modules/imports/imports.module';
import { GoogleDriveModule } from './modules/integrations/google-drive/google-drive.module';
import { GoogleCalendarModule } from './modules/integrations/google-calendar/google-calendar.module';
import { AiActionsModule } from './modules/ai-actions/ai-actions.module';
// import { IntegrationsModule } from './modules/integrations/integrations.module';

// Services
import { EmailModule } from './common/email/email.module';
import { PdfModule } from './common/pdf/pdf.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { RateLimitingModule } from './common/rate-limiting/rate-limiting.module';
import { CacheModule } from './common/cache/cache.module';

@Module({
  imports: [
    // Configuration with validation
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    // Scheduling for cron jobs
    ScheduleModule.forRoot(),

    // Rate limiting - more lenient for normal usage, configurable via env
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
      {
          ttl: configService.get<number>('THROTTLE_TTL', 60000), // 60 seconds
          limit: configService.get<number>('THROTTLE_LIMIT', 1000), // 1000 requests per minute
      },
      ],
    }),

    // Core
    PrismaModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    DashboardModule,

    // CRM
    CustomersModule,
    ContactsModule,
    LeadsModule,
    OpportunitiesModule,
    // CampaignsModule,

    // Finance
    InvoicesModule,

    // Recruitment
    CandidatesModule,
    OpenPositionsModule,

    // HR & Employees
    HrModule,
    // EodReportsModule,

    // Tasks
    TasksModule,

    // Universal
    ActivitiesModule,
    NotificationsModule,
    // MeetingsModule,
    // ReportsModule,
    TemplatesModule,

    // Integrations
    ImportsModule,
    GoogleDriveModule,
    GoogleCalendarModule,
    AiActionsModule,
    // IntegrationsModule,

    // Services
    EmailModule,
    PdfModule,
    EncryptionModule,
    RateLimitingModule,
    CacheModule,
  ],
})
export class AppModule {}

