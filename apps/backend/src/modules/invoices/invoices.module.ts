import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EmailModule } from '../../common/email/email.module';
import { PdfModule } from '../../common/pdf/pdf.module';

@Module({
  imports: [PrismaModule, EmailModule, PdfModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}


