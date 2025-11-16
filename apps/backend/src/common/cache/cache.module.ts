import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInterceptor } from '../interceptors/cache.interceptor';

@Global()
@Module({
  providers: [CacheService, CacheInterceptor],
  exports: [CacheService, CacheInterceptor],
})
export class CacheModule {}

