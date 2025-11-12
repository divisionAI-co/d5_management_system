import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../common/prisma/prisma.module';
import { InvoicesImportService } from './invoices-import.service';
import { InvoicesImportController } from './invoices-import.controller';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesImportController],
  providers: [InvoicesImportService],
})
export class InvoicesImportModule {}
