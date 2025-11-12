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

import { LeadsImportService } from './leads-import.service';
import { LeadMapImportDto } from './dto/lead-map-import.dto';
import { ExecuteLeadImportDto } from './dto/execute-lead-import.dto';

@ApiTags('Imports - Leads')
@ApiBearerAuth()
@Controller({
  path: 'imports/leads',
  version: '1',
})
export class LeadsImportController {
  constructor(private readonly leadsImportService: LeadsImportService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Upload a CSV file exported from Odoo for lead import',
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
  uploadLeads(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A CSV file must be provided.');
    }
    return this.leadsImportService.uploadLeadsImport(file);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List recent lead import jobs' })
  listImports() {
    return this.leadsImportService.listLeadsImports();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get information about a specific lead import job' })
  getImport(@Param('id') id: string) {
    return this.leadsImportService.getLeadsImport(id);
  }

  @Post(':id/map')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Submit the field mapping between CSV columns and lead properties',
  })
  saveMapping(@Param('id') id: string, @Body() dto: LeadMapImportDto) {
    return this.leadsImportService.saveLeadsMapping(id, dto);
  }

  @Post(':id/execute')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Execute the lead import job after mappings have been configured',
  })
  executeImport(
    @Param('id') id: string,
    @Body() dto: ExecuteLeadImportDto,
  ) {
    return this.leadsImportService.executeLeadsImport(id, dto);
  }
}


