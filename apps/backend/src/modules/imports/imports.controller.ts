import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

import {
  ContactImportSummary,
  ImportsService,
  ImportType,
  UploadImportResult,
} from './imports.service';
import { MapImportDto } from './dto/map-import.dto';
import { ExecuteImportDto } from './dto/execute-import.dto';

@ApiTags('Imports')
@ApiBearerAuth()
@Controller({
  path: 'imports',
  version: '1',
})
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload a CSV file exported from Odoo for CRM import' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'file'],
      properties: {
        type: {
          type: 'string',
          enum: ['contacts', 'leads'],
          default: 'contacts',
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
    @Body('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadImportResult> {
    const normalizedType = (type ?? 'contacts').trim().toLowerCase();
    if (
      normalizedType !== 'contacts' &&
      normalizedType !== 'leads' &&
      normalizedType !== 'opportunities'
    ) {
      throw new BadRequestException('Unsupported import type provided.');
    }
    return this.importsService.uploadImport(
      normalizedType as ImportType,
      file,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List recent CRM import jobs' })
  listImports(@Query('type') type?: ImportType) {
    const normalizedType: ImportType =
      type === 'leads'
        ? 'leads'
        : type === 'opportunities'
        ? 'opportunities'
        : 'contacts';
    return this.importsService.listImports(normalizedType);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get information about a specific import job' })
  getImport(@Param('id') id: string) {
    return this.importsService.getImport(id);
  }

  @Post(':id/map')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Submit the field mapping between CSV columns and CRM fields',
  })
  saveMapping(@Param('id') id: string, @Body() dto: MapImportDto) {
    return this.importsService.saveMapping(id, dto);
  }

  @Post(':id/execute')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Execute the import job after mappings have been configured',
  })
  executeImport(
    @Param('id') id: string,
    @Body() dto: ExecuteImportDto,
  ): Promise<ContactImportSummary> {
    return this.importsService.executeImport(id, dto);
  }
}


