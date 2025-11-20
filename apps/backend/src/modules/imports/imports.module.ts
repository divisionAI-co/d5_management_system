import { Module } from '@nestjs/common';

import { ContactsImportModule } from './contacts/contacts-import.module';
import { LeadsImportModule } from './leads/leads-import.module';
import { EmployeesImportModule } from './employees/employees-import.module';
import { EodImportModule } from './eod/eod-import.module';
import { InvoicesImportModule } from './invoices/invoices-import.module';
import { CandidatesImportModule } from './candidates/candidates-import.module';
import { OpportunitiesImportModule } from './opportunities/opportunities-import.module';
import { SystemExportModule } from './system-export/system-export.module';
import { CheckInsImportModule } from './check-ins/check-ins-import.module';

@Module({
  imports: [
    ContactsImportModule,
    LeadsImportModule,
    EmployeesImportModule,
    EodImportModule,
    InvoicesImportModule,
    CandidatesImportModule,
    OpportunitiesImportModule,
    SystemExportModule,
    CheckInsImportModule,
  ],
})
export class ImportsModule {}


