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

import { EodImportService } from './eod-import.service';
import { EodMapImportDto } from './dto/eod-map-import.dto';
import { ExecuteEodImportDto } from './dto/execute-eod-import.dto';

@ApiTags('Imports - EOD Reports')
@ApiBearerAuth()
@Controller({
  path: 'imports/eod',
  version: '1',
})
export class EodImportController {
  constructor(private readonly eodImportService: EodImportService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Upload an Excel or CSV file of EOD reports exported from Odoo',
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
    return this.eodImportService.uploadEodImport(file);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'List recent EOD import jobs' })
  list() {
    return this.eodImportService.listEodImports();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get information about a specific EOD import job' })
  get(@Param('id') id: string) {
    return this.eodImportService.getEodImport(id);
  }

  @Post(':id/map')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Submit column mappings between the spreadsheet and EOD fields',
  })
  map(@Param('id') id: string, @Body() dto: EodMapImportDto) {
    return this.eodImportService.saveEodMapping(id, dto);
  }

  @Post(':id/execute')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Execute the EOD import after mappings are configured' })
  execute(@Param('id') id: string, @Body() dto: ExecuteEodImportDto) {
    return this.eodImportService.executeEodImport(id, dto);
  }
}
