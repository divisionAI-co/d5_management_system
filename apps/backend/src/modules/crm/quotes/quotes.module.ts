import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { PdfModule } from '../../../common/pdf/pdf.module';
import { EmailModule } from '../../../common/email/email.module';
import { TemplatesModule } from '../../templates/templates.module';

@Module({
  imports: [PrismaModule, PdfModule, EmailModule, TemplatesModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}

