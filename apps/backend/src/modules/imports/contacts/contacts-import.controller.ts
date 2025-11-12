import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
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

import { ContactsImportService } from './contacts-import.service';
import { ContactMapImportDto } from './dto/contact-map-import.dto';
import { ExecuteContactImportDto } from './dto/execute-contact-import.dto';

@ApiTags('Imports - Contacts')
@ApiBearerAuth()
@Controller({
  path: 'imports',
  version: '1',
})
export class ContactsImportController {
  constructor(private readonly contactsImportService: ContactsImportService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Upload a CSV file exported from Odoo for contact import',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        type: {
          type: 'string',
          enum: ['contacts'],
          description:
            'Optional legacy field. Defaults to contacts when omitted.',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadContacts(
    @Body('type') type: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const normalizedType = type?.trim().toLowerCase();
    if (normalizedType && normalizedType !== 'contacts') {
      throw new BadRequestException(
        'Only contact imports are currently supported.',
      );
    }

    return this.contactsImportService.uploadContactsImport(file);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List recent contact import jobs' })
  listImports() {
    return this.contactsImportService.listContactsImports();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get information about a specific import job' })
  getImport(@Param('id') id: string) {
    return this.contactsImportService.getContactsImport(id);
  }

  @Post(':id/map')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Submit the field mapping between CSV columns and contact properties',
  })
  saveMapping(@Param('id') id: string, @Body() dto: ContactMapImportDto) {
    return this.contactsImportService.saveContactsMapping(id, dto);
  }

  @Post(':id/execute')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Execute the import job after mappings have been configured',
  })
  executeImport(
    @Param('id') id: string,
    @Body() dto: ExecuteContactImportDto,
  ) {
    return this.contactsImportService.executeContactsImport(id, dto);
  }
}


