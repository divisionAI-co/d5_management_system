import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    this.logger.log(`[JWT Validation] Starting validation for payload: ${JSON.stringify({ sub: payload.sub, iat: payload.iat, exp: payload.exp })}`);

    if (!payload || !payload.sub) {
      this.logger.error('[JWT Validation] Invalid payload: missing sub field');
      throw new UnauthorizedException('Invalid token payload');
    }

    try {
    const user = await this.usersService.findById(payload.sub);
      this.logger.log(`[JWT Validation] User lookup result: ${user ? `Found user ${user.id} (active: ${user.isActive})` : 'User not found'}`);

      if (!user) {
        this.logger.error(`[JWT Validation] User not found for ID: ${payload.sub}`);
        throw new UnauthorizedException('User not found or inactive');
      }

      if (!user.isActive) {
        this.logger.error(`[JWT Validation] User is inactive: ${payload.sub}`);
      throw new UnauthorizedException('User not found or inactive');
    }

      this.logger.log(`[JWT Validation] Successfully validated user: ${user.email} (${user.id})`);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`[JWT Validation] Error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

