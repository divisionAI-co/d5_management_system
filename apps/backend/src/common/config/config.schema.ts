import * as Joi from 'joi';

export { Joi };

/**
 * Environment variable validation schema
 * Validates all required and optional environment variables on application startup
 */
export const configValidationSchema = Joi.object({
  // Server
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),

  // Database - REQUIRED
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required',
    'string.empty': 'DATABASE_URL cannot be empty',
  }),

  // JWT - REQUIRED
  JWT_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_SECRET is required (minimum 32 characters)',
    'string.min': 'JWT_SECRET must be at least 32 characters long',
  }),
  JWT_REFRESH_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_REFRESH_SECRET is required (minimum 32 characters)',
    'string.min': 'JWT_REFRESH_SECRET must be at least 32 characters long',
  }),
  JWT_EXPIRES_IN: Joi.string().default('24h'), // Increased from 15m for better UX
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  // Encryption - REQUIRED
  ENCRYPTION_KEY: Joi.string()
    .length(64)
    .pattern(/^[0-9a-fA-F]+$/)
    .required()
    .messages({
      'any.required': 'ENCRYPTION_KEY is required (64 hex characters)',
      'string.length': 'ENCRYPTION_KEY must be exactly 64 hex characters',
      'string.pattern.base': 'ENCRYPTION_KEY must be a valid hex string',
    }),

  // CORS
  CORS_ORIGINS: Joi.string().default('').description('Comma-separated list of allowed origins'),

  // Email (optional)
  EMAIL_PROVIDER: Joi.string().valid('smtp', 'sendgrid', 'ses').optional(),
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASSWORD: Joi.string().optional(),
  SENDGRID_API_KEY: Joi.string().optional(),
  AWS_SES_REGION: Joi.string().optional(),
  AWS_SES_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SES_SECRET_ACCESS_KEY: Joi.string().optional(),

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),
  GOOGLE_REDIRECT_URI: Joi.string().uri().optional(),

  // Password Reset
  PASSWORD_RESET_TOKEN_EXPIRY_HOURS: Joi.number().default(1),
  USER_INVITE_EXPIRY_HOURS: Joi.number().default(72),

  // 2FA
  TWO_FACTOR_AUTHENTICATION_APP_NAME: Joi.string().default('division5'),

  // Rate Limiting - more lenient defaults
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(1000),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_ATTEMPTS: Joi.number().default(10), // Increased from 5
  MAX_FAILED_LOGIN_ATTEMPTS: Joi.number().default(10), // Increased from 5
  ACCOUNT_LOCKOUT_DURATION_MS: Joi.number().default(15 * 60 * 1000), // 15 minutes (reduced from 30)

  // Redis Cache (optional)
  REDIS_ENABLED: Joi.string().valid('true', 'false').default('false'),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().default(0),

  // Prisma Query Logging (development only)
  PRISMA_LOG_QUERIES: Joi.string()
    .valid('true', 'false')
    .optional()
    .description('Enable verbose Prisma query logging in development (default: false)'),

  // Swagger Documentation
  SWAGGER_ENABLED: Joi.string()
    .valid('true', 'false')
    .default('true')
    .description('Enable/disable Swagger API documentation (default: true)'),
  SWAGGER_USERNAME: Joi.string()
    .default('admin')
    .description('Basic auth username for Swagger in production (default: admin)'),
  SWAGGER_PASSWORD: Joi.string()
    .optional()
    .description('Basic auth password for Swagger in production (required in production if SWAGGER_ENABLED=true)'),
});

