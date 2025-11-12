import { Module } from '@nestjs/common';

import { ContactsImportModule } from './contacts/contacts-import.module';
import { LeadsImportModule } from './leads/leads-import.module';
import { EmployeesImportModule } from './employees/employees-import.module';
import { EodImportModule } from './eod/eod-import.module';
import { InvoicesImportModule } from './invoices/invoices-import.module';
import { CandidatesImportModule } from './candidates/candidates-import.module';

@Module({
  imports: [
    ContactsImportModule,
    LeadsImportModule,
    EmployeesImportModule,
    EodImportModule,
    InvoicesImportModule,
    CandidatesImportModule,
  ],
})
export class ImportsModule {}


