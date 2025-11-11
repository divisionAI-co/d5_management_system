import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security
  app.use(helmet());
  
  // Compression
  app.use(compression());

  // CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS')?.split(',') || [];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  app.setGlobalPrefix(apiPrefix);

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('D5 Management System API')
    .setDescription('Integrated Business Management Platform - REST API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management')
    .addTag('CRM', 'Customer Relationship Management')
    .addTag('Leads', 'Lead management')
    .addTag('Opportunities', 'Opportunity management')
    .addTag('Campaigns', 'Email campaigns and sequences')
    .addTag('Invoices', 'Billing and invoicing')
    .addTag('Recruitment', 'Candidate and recruitment management')
    .addTag('Employees', 'Employee and HR management')
    .addTag('EOD Reports', 'End-of-Day reporting')
    .addTag('Tasks', 'Task management')
    .addTag('Activities', 'Universal activity tracking')
    .addTag('Notifications', 'Notification system')
    .addTag('Meetings', 'Meeting scheduling')
    .addTag('Reports', 'Customer reports')
    .addTag('Templates', 'Template management')
    .addTag('Imports', 'Data import from Odoo')
    .addTag('Integrations', 'External integrations (Google Drive, Calendar)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Start server
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`
    🚀 D5 Management System API is running!
    📝 API: http://localhost:${port}/${apiPrefix}
    📚 Docs: http://localhost:${port}/${apiPrefix}/docs
    🌍 Environment: ${configService.get<string>('NODE_ENV', 'development')}
  `);
}

bootstrap();

