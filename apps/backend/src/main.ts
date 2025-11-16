import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security headers with strict configuration
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for Swagger UI
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
            },
          }
        : false, // Disable in development for easier debugging
      crossOriginEmbedderPolicy: false, // Disable for Swagger compatibility
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
    }),
  );

  // Cookie parsing (required for HttpOnly refresh tokens)
  app.use(cookieParser());

  // Compression
  app.use(compression());

  // CORS - Strict configuration for production
  const corsOriginsRaw = configService.get<string>('CORS_ORIGINS', '');
  const corsOrigins = corsOriginsRaw
    ? corsOriginsRaw.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

  if (isProduction && corsOrigins.length === 0) {
    console.warn(
      '⚠️  WARNING: CORS_ORIGINS is not set in production. This is a security risk!',
    );
  }

  app.enableCors({
    origin:
      corsOrigins.length > 0
        ? (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, etc.) in development
            if (!origin && !isProduction) {
              return callback(null, true);
            }
            if (origin && corsOrigins.includes(origin)) {
              callback(null, true);
            } else {
              callback(new Error('Not allowed by CORS'));
            }
          }
        : isProduction
          ? false // Block all in production if not configured
          : true, // Allow all in development if not configured
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
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
    .setTitle('division5 API')
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

  // Log startup info (never log secrets)
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  console.log(`
    🚀 division5 API is running!
    📝 API: http://localhost:${port}/${apiPrefix}
    📚 Docs: http://localhost:${port}/${apiPrefix}/docs
    🌍 Environment: ${nodeEnv}
    🔒 Security: ${isProduction ? 'Production mode (strict)' : 'Development mode'}
    ${corsOrigins.length > 0 ? `🌐 CORS: ${corsOrigins.length} origin(s) configured` : '⚠️  CORS: No origins configured'}
  `);

  // Validate critical security settings in production
  if (isProduction) {
    const jwtSecret = configService.get<string>('JWT_SECRET', '');
    const encryptionKey = configService.get<string>('ENCRYPTION_KEY', '');
    
    if (jwtSecret.length < 32) {
      console.error('❌ CRITICAL: JWT_SECRET is too short (minimum 32 characters)');
      process.exit(1);
    }
    
    if (!encryptionKey || encryptionKey.length !== 64) {
      console.error('❌ CRITICAL: ENCRYPTION_KEY is invalid (must be 64 hex characters)');
      process.exit(1);
    }
    
    if (corsOrigins.length === 0) {
      console.error('❌ CRITICAL: CORS_ORIGINS must be configured in production');
      process.exit(1);
    }
    
    console.log('✅ Security configuration validated');
  }
}

bootstrap();

