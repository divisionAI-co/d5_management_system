import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

import { InvoicesImportService } from './invoices-import.service';
import { InvoiceMapImportDto } from './dto/invoice-map-import.dto';
import { ExecuteInvoiceImportDto } from './dto/execute-invoice-import.dto';

@ApiTags('Imports - Invoices')
@ApiBearerAuth()
@Controller({
  path: 'imports/invoices',
  version: '1',
})
export class InvoicesImportController {
  constructor(private readonly invoicesImportService: InvoicesImportService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({
    summary: 'Upload an Excel or CSV file for invoice import',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.invoicesImportService.uploadInvoicesImport(file);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'List recent invoice import jobs' })
  list() {
    return this.invoicesImportService.listInvoicesImports();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Get information about a specific invoice import job' })
  get(@Param('id') id: string) {
    return this.invoicesImportService.getInvoicesImport(id);
  }

  @Post(':id/map')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Submit column mappings for the invoice import' })
  map(@Param('id') id: string, @Body() dto: InvoiceMapImportDto) {
    return this.invoicesImportService.saveInvoicesMapping(id, dto);
  }

  @Post(':id/execute')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Execute the invoice import after mapping is configured' })
  execute(@Param('id') id: string, @Body() dto: ExecuteInvoiceImportDto) {
    return this.invoicesImportService.executeInvoicesImport(id, dto);
  }
}
