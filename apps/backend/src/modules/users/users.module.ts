import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EmailModule } from '../../common/email/email.module';
import { RateLimitingModule } from '../../common/rate-limiting/rate-limiting.module';

@Module({
  imports: [EmailModule, RateLimitingModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
