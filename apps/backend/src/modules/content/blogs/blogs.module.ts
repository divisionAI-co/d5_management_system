import { Module } from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { BlogsController } from './blogs.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { StorageModule } from '../../../common/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [BlogsController],
  providers: [BlogsService],
  exports: [BlogsService],
})
export class BlogsModule {}

