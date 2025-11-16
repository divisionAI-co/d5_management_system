import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_KEY = 'cache_ttl';
export const CACHE_KEY_PREFIX = 'cache_key_prefix';

/**
 * Decorator to enable caching for an endpoint
 * @param ttlSeconds Time to live in seconds (default: 300 = 5 minutes)
 * @param keyPrefix Optional prefix for cache key (default: route path)
 */
export const Cache = (ttlSeconds: number = 300, keyPrefix?: string) => {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey && descriptor) {
      SetMetadata(CACHE_TTL_KEY, ttlSeconds)(target, propertyKey, descriptor);
      if (keyPrefix) {
        SetMetadata(CACHE_KEY_PREFIX, keyPrefix)(target, propertyKey, descriptor);
      }
    }
  };
};

