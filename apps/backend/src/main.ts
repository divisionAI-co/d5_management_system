import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
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
      // Content-Security-Policy: Prevents XSS attacks by controlling which resources can be loaded
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
      // Strict-Transport-Security: Forces HTTPS connections
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
      // Referrer-Policy: Controls how much referrer information is sent with requests
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      crossOriginEmbedderPolicy: false, // Disable for Swagger compatibility
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Permissions-Policy: Restricts browser features and APIs
  // Note: This is set via custom middleware as Helmet v7 removed built-in support
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      [
        'accelerometer=()',
        'ambient-light-sensor=()',
        'autoplay=(self)',
        'battery=()',
        'camera=()',
        'cross-origin-isolated=()',
        'display-capture=()',
        'document-domain=()',
        'encrypted-media=(self)',
        'execution-while-not-rendered=()',
        'execution-while-out-of-viewport=()',
        'fullscreen=(self)',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'midi=()',
        'navigation-override=()',
        'payment=()',
        'picture-in-picture=()',
        'publickey-credentials-get=(self)',
        'screen-wake-lock=()',
        'sync-xhr=()',
        'usb=()',
        'web-share=(self)',
        'xr-spatial-tracking=()',
      ].join(', '),
    );
    next();
  });

  // Cookie parsing (required for HttpOnly refresh tokens)
  app.use(cookieParser());

  // Compression
  app.use(compression());

  // CORS - Flexible configuration with better matching
  const corsOriginsRaw = configService.get<string>('CORS_ORIGINS', '');
  const corsOrigins = corsOriginsRaw
    ? corsOriginsRaw.split(',').map((origin) => origin.trim().toLowerCase().replace(/\/$/, '')).filter(Boolean)
    : [];

  if (isProduction && corsOrigins.length === 0) {
    console.warn(
      '⚠️  WARNING: CORS_ORIGINS is not set in production. Allowing all origins (less secure).',
    );
  } else if (corsOrigins.length > 0 && process.env.NODE_ENV === 'development') {
    console.log(`🌐 CORS: Configured ${corsOrigins.length} origin(s): ${corsOrigins.join(', ')}`);
  }

  // Custom CORS middleware that handles both public and protected endpoints
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path.toLowerCase();
    const origin = req.headers.origin;
    
    // Check if this is a public API endpoint (check both with and without /api/v1 prefix)
    const isPublicEndpoint = 
      path.includes('/recruitment/positions/public') ||
      path.includes('/recruitment/applications/public') ||
      path.includes('/content/blogs/public') ||
      path.includes('/content/case-studies/public') ||
      path.includes('positions/public') ||
      path.includes('applications/public') ||
      path.includes('blogs/public') ||
      path.includes('case-studies/public');
    
    if (isPublicEndpoint) {
      // Allow all origins for public endpoints
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key');
      res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Page-Count');
      res.setHeader('Access-Control-Max-Age', '86400');
      
      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
    } else {
      // For protected endpoints, use standard CORS with origin checking
      if (corsOrigins.length > 0 && origin) {
            const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '');
            const isAllowed = corsOrigins.some((allowed) => {
              if (normalizedOrigin === allowed) {
                return true;
              }
              if (allowed.startsWith('*.')) {
                const domain = allowed.substring(2);
                return normalizedOrigin.endsWith('.' + domain) || normalizedOrigin === domain;
              }
              return false;
            });
            
            if (isAllowed) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key');
          res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Page-Count');
          res.setHeader('Access-Control-Max-Age', '86400');
          
          if (req.method === 'OPTIONS') {
            return res.status(200).end();
          }
            } else {
          // Log blocked origin for debugging
              if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
                console.warn(`🚫 CORS blocked: ${origin} (normalized: ${normalizedOrigin}). Allowed: ${corsOrigins.join(', ')}`);
              }
          return res.status(403).json({ message: 'Not allowed by CORS' });
            }
      } else if (corsOrigins.length === 0) {
        // No CORS restrictions configured, allow all
        if (origin) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
          res.setHeader('Access-Control-Allow-Origin', '*');
        }
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key');
        res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Page-Count');
        res.setHeader('Access-Control-Max-Age', '86400');
        
        if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }
      }
    }
    
    next();
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
  const swaggerEnabled = configService.get<string>('SWAGGER_ENABLED', 'true') !== 'false';
  const swaggerUsername = configService.get<string>('SWAGGER_USERNAME', 'admin');
  const swaggerPassword = configService.get<string>('SWAGGER_PASSWORD', '');

  // Protect Swagger with basic auth in production
  if (isProduction && swaggerEnabled) {
    if (!swaggerPassword) {
      console.warn('⚠️  WARNING: SWAGGER_PASSWORD is not set in production. Swagger will be disabled for security.');
    } else {
      // Basic authentication middleware for Swagger (protects both UI and JSON endpoints)
      const swaggerBasicAuth = (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Basic ')) {
          res.setHeader('WWW-Authenticate', 'Basic realm="Swagger API Documentation"');
          return res.status(401).send('Authentication required');
        }

        // Decode basic auth credentials
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [username, password] = credentials.split(':');

        if (username === swaggerUsername && password === swaggerPassword) {
          return next();
        }

        res.setHeader('WWW-Authenticate', 'Basic realm="Swagger API Documentation"');
        return res.status(401).send('Invalid credentials');
      };

      // Protect all Swagger endpoints
      app.use(`${apiPrefix}/docs`, swaggerBasicAuth);
      app.use(`${apiPrefix}/docs-json`, swaggerBasicAuth);
      app.use(`${apiPrefix}/docs-yaml`, swaggerBasicAuth);
    }
  }

  if (swaggerEnabled && (!isProduction || swaggerPassword)) {
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
  } else if (!swaggerEnabled) {
    console.log('📚 Swagger documentation is disabled (SWAGGER_ENABLED=false)');
  }

  // Start server
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  // Log startup info (never log secrets)
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const swaggerStatus = swaggerEnabled && (!isProduction || swaggerPassword)
    ? `📚 Docs: http://localhost:${port}/${apiPrefix}/docs${isProduction ? ' (Basic Auth required)' : ''}`
    : '📚 Docs: Disabled';
  
  console.log(`
    🚀 division5 API is running!
    📝 API: http://localhost:${port}/${apiPrefix}
    ${swaggerStatus}
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
    
    // Validate Swagger security in production
    if (swaggerEnabled && !swaggerPassword) {
      console.error('❌ CRITICAL: SWAGGER_PASSWORD must be set in production when Swagger is enabled');
      process.exit(1);
    }
    
    console.log('✅ Security configuration validated');
  }
}

bootstrap();

