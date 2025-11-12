import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../common/prisma/prisma.module';
import { ContactsImportController } from './contacts-import.controller';
import { ContactsImportService } from './contacts-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContactsImportController],
  providers: [ContactsImportService],
  exports: [ContactsImportService],
})
export class ContactsImportModule {}


