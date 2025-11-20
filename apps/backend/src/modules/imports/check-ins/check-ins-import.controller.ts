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
import { CheckInsImportService } from './check-ins-import.service';
import { CheckInMapImportDto } from './dto/check-in-map-import.dto';
import { ExecuteCheckInImportDto } from './dto/execute-check-in-import.dto';

@ApiTags('Imports - Check-ins')
@ApiBearerAuth()
@Controller({
  path: 'imports/check-ins',
  version: '1',
})
export class CheckInsImportController {
  constructor(private readonly checkInsImportService: CheckInsImportService) {}

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
    return this.checkInsImportService.uploadCheckInsImport(file);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'List recent check-ins import jobs' })
  list() {
    return this.checkInsImportService.listCheckInsImports();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get information about a specific check-ins import job' })
  get(@Param('id') id: string) {
    return this.checkInsImportService.getCheckInsImport(id);
  }

  @Post(':id/map')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Submit column mappings between the spreadsheet and check-in fields',
  })
  map(@Param('id') id: string, @Body() dto: CheckInMapImportDto) {
    return this.checkInsImportService.saveCheckInsMapping(id, dto);
  }

  @Get(':id/validate')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Validate import and detect unmatched values',
    description:
      'Scans the import data to identify employee card numbers that cannot be automatically matched. Returns a list of unmatched card numbers that require manual matching.',
  })
  validate(@Param('id') id: string) {
    return this.checkInsImportService.validateCheckInsImport(id);
  }

  @Post(':id/execute')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Execute the check-ins import after mappings are configured' })
  execute(@Param('id') id: string, @Body() dto: ExecuteCheckInImportDto) {
    return this.checkInsImportService.executeCheckInsImport(id, dto);
  }
}

