import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CacheService } from '../cache/cache.service';
import { CACHE_TTL_KEY, CACHE_KEY_PREFIX } from '../decorators/cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    // Check if caching is enabled
    if (!this.cacheService.isAvailable()) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get TTL from decorator
    const ttl = this.reflector.getAllAndOverride<number>(CACHE_TTL_KEY, [
      handler,
      controller,
    ]);

    // If no TTL is set, skip caching
    if (!ttl) {
      return next.handle();
    }

    // Generate cache key
    const keyPrefix = this.reflector.getAllAndOverride<string>(CACHE_KEY_PREFIX, [
      handler,
      controller,
    ]);

    const cacheKey = this.generateCacheKey(request, keyPrefix);

    // Try to get from cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached !== null) {
      return of(cached);
    }

    // If not cached, execute handler and cache result
    return next.handle().pipe(
      tap(async (data) => {
        await this.cacheService.set(cacheKey, data, ttl);
      }),
    );
  }

  private generateCacheKey(request: Request, keyPrefix?: string): string {
    const userId = (request.user as any)?.id;
    const path = keyPrefix || request.route?.path || request.path;
    const query = JSON.stringify(request.query);

    if (userId) {
      return this.cacheService.generateKey(path, userId, query);
    }
    return this.cacheService.generateKey(path, query);
  }
}

