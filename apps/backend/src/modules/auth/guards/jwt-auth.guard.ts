import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();
    const route = `${controller.name}.${handler.name}`;
    const path = request.url;
    const method = request.method;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      handler,
      controller,
    ]);

    this.logger.log(`[JWT Guard] ${method} ${path} - Route: ${route}, Public: ${isPublic}`);

    if (isPublic) {
      this.logger.log(`[JWT Guard] Public route, skipping authentication`);
      return true;
    }

    // Extract token for logging
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      this.logger.log(`[JWT Guard] Token present: ${token.substring(0, 20)}... (length: ${token.length})`);
    } else {
      this.logger.warn(`[JWT Guard] No authorization header found for ${method} ${path}`);
    }

    try {
      const result = super.canActivate(context);
      this.logger.log(`[JWT Guard] Authentication check initiated for ${method} ${path}`);
      return result;
    } catch (error) {
      this.logger.error(`[JWT Guard] Authentication failed for ${method} ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const path = request.url;
    const method = request.method;

    if (err) {
      this.logger.error(`[JWT Guard] Authentication error for ${method} ${path}: ${err.message || err}`, err.stack);
      throw err;
    }

    if (!user) {
      this.logger.warn(`[JWT Guard] No user found after authentication for ${method} ${path}. Info: ${info ? JSON.stringify(info) : 'none'}`);
      throw new Error('Authentication failed: No user found');
    }

    this.logger.log(`[JWT Guard] Authentication successful for ${method} ${path}. User: ${user.email} (${user.id})`);
    return user;
  }
}

