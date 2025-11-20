import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Request,
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

import { CheckInOutImportService } from './check-in-out-import.service';
import { CheckInOutMapImportDto } from './dto/check-in-out-map-import.dto';
import { ExecuteCheckInOutImportDto } from './dto/execute-check-in-out-import.dto';

@ApiTags('Imports - Check-In/Check-Out')
@ApiBearerAuth()
@Controller({
  path: 'imports/check-in-outs',
  version: '1',
})
export class CheckInOutImportController {
  constructor(private readonly checkInOutImportService: CheckInOutImportService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Upload an Excel or CSV file of check-in/check-out records',
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
    return this.checkInOutImportService.uploadCheckInOutImport(file);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'List recent check-in/out import jobs' })
  list() {
    return this.checkInOutImportService.listCheckInOutImports();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get information about a specific check-in/out import job' })
  get(@Param('id') id: string) {
    return this.checkInOutImportService.getCheckInOutImport(id);
  }

  @Post(':id/map')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Submit column mappings between the spreadsheet and check-in/out fields',
  })
  map(@Param('id') id: string, @Body() dto: CheckInOutMapImportDto) {
    return this.checkInOutImportService.saveCheckInOutMapping(id, dto);
  }

  @Get(':id/validate')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Validate import and detect unmatched employees',
    description:
      'Scans the import data to identify employees that cannot be automatically matched. Returns a list of unmatched employees that require manual matching.',
  })
  validate(@Param('id') id: string) {
    return this.checkInOutImportService.validateCheckInOutImport(id);
  }

  @Post(':id/execute')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Execute the check-in/out import after mappings are configured' })
  execute(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: ExecuteCheckInOutImportDto,
  ) {
    return this.checkInOutImportService.executeCheckInOutImport(id, dto, req.user.id);
  }
}

