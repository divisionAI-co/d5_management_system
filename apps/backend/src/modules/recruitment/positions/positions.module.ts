import { Module } from '@nestjs/common';
import { OpenPositionsService } from './positions.service';
import { OpenPositionsController } from './positions.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OpenPositionsController],
  providers: [OpenPositionsService],
  exports: [OpenPositionsService],
})
export class OpenPositionsModule {}


