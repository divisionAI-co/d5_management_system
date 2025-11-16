import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Service
 *
 * Database connection pooling configuration:
 * Configure connection pooling in your DATABASE_URL environment variable:
 *
 * Example:
 * DATABASE_URL="postgresql://user:password@host:5432/database?connection_limit=10&pool_timeout=20&connect_timeout=10"
 *
 * Recommended settings for production:
 * - connection_limit: 10-20 (adjust based on your server capacity)
 * - pool_timeout: 20 (seconds to wait for a connection from the pool)
 * - connect_timeout: 10 (seconds to wait when establishing a new connection)
 *
 * For high-traffic applications, consider using PgBouncer in transaction pooling mode.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Query logging can be enabled via PRISMA_LOG_QUERIES=true environment variable
    // This is useful for debugging but can be very verbose
    const enableQueryLogging =
      process.env.NODE_ENV === 'development' &&
      process.env.PRISMA_LOG_QUERIES === 'true';

    super({
      log: enableQueryLogging
        ? ['query', 'info', 'warn', 'error']
        : process.env.NODE_ENV === 'development'
          ? ['info', 'warn', 'error']
          : ['error', 'warn'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  /**
   * Clean database for testing purposes
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === 'string' && key[0] !== '_',
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as any).deleteMany();
        }
      }),
    );
  }
}

