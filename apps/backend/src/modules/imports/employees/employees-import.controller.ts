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

import { EmployeesImportService } from './employees-import.service';
import { EmployeeMapImportDto } from './dto/employee-map-import.dto';
import { ExecuteEmployeeImportDto } from './dto/execute-employee-import.dto';

@ApiTags('Imports - Employees')
@ApiBearerAuth()
@Controller({
  path: 'imports/employees',
  version: '1',
})
export class EmployeesImportController {
  constructor(private readonly employeesImportService: EmployeesImportService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Upload a CSV file exported from Odoo for employee import',
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
    return this.employeesImportService.uploadEmployeesImport(file);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'List recent employee import jobs' })
  list() {
    return this.employeesImportService.listEmployeesImports();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get information about a specific employee import job' })
  get(@Param('id') id: string) {
    return this.employeesImportService.getEmployeesImport(id);
  }

  @Post(':id/map')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Submit the field mapping between CSV columns and employee fields',
  })
  map(@Param('id') id: string, @Body() dto: EmployeeMapImportDto) {
    return this.employeesImportService.saveEmployeesMapping(id, dto);
  }

  @Post(':id/execute')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Execute the employee import job after mapping' })
  execute(@Param('id') id: string, @Body() dto: ExecuteEmployeeImportDto) {
    return this.employeesImportService.executeEmployeesImport(id, dto);
  }
}
