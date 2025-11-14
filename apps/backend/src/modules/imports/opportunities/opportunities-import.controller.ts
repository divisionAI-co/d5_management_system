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

import { OpportunitiesImportService } from './opportunities-import.service';
import { OpportunityMapImportDto } from './dto/opportunity-map-import.dto';
import { ExecuteOpportunityImportDto } from './dto/execute-opportunity-import.dto';

@ApiTags('Imports - Opportunities')
@ApiBearerAuth()
@Controller({
  path: 'imports/opportunities',
  version: '1',
})
export class OpportunitiesImportController {
  constructor(private readonly opportunitiesImportService: OpportunitiesImportService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({
    summary: 'Upload a CSV or Excel file exported from Odoo for opportunity import',
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
    return this.opportunitiesImportService.uploadOpportunitiesImport(file);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'List recent opportunity import jobs' })
  list() {
    return this.opportunitiesImportService.listOpportunitiesImports();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Get details for a specific opportunity import job' })
  get(@Param('id') id: string) {
    return this.opportunitiesImportService.getOpportunitiesImport(id);
  }

  @Post(':id/map')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({
    summary: 'Submit field mappings between spreadsheet columns and opportunity fields',
  })
  map(@Param('id') id: string, @Body() dto: OpportunityMapImportDto) {
    return this.opportunitiesImportService.saveOpportunitiesMapping(id, dto);
  }

  @Post(':id/execute')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({
    summary: 'Execute the opportunity import after mappings and defaults are configured',
  })
  execute(@Param('id') id: string, @Body() dto: ExecuteOpportunityImportDto) {
    return this.opportunitiesImportService.executeOpportunitiesImport(id, dto);
  }
}


