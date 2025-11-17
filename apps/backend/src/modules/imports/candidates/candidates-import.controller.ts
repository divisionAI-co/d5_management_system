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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

import { CandidatesImportService } from './candidates-import.service';
import { CandidateMapImportDto } from './dto/candidate-map-import.dto';
import { ExecuteCandidateImportDto } from './dto/execute-candidate-import.dto';

@ApiTags('Imports - Candidates')
@ApiBearerAuth()
@Controller({
  path: 'imports/candidates',
  version: '1',
})
export class CandidatesImportController {
  constructor(private readonly candidatesImportService: CandidatesImportService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Upload an Excel or CSV file for candidate import' })
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
    return this.candidatesImportService.uploadCandidatesImport(file);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.RECRUITER)
  @ApiOperation({ summary: 'List recent candidate import jobs' })
  list() {
    return this.candidatesImportService.listCandidatesImports();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Get information about a specific candidate import job' })
  get(@Param('id') id: string) {
    return this.candidatesImportService.getCandidatesImport(id);
  }

  @Post(':id/map')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Submit column mappings for the candidate import' })
  map(@Param('id') id: string, @Body() dto: CandidateMapImportDto) {
    return this.candidatesImportService.saveCandidatesMapping(id, dto);
  }

  @Get(':id/validate')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.RECRUITER)
  @ApiOperation({
    summary: 'Validate import and detect unmatched values',
    description:
      'Scans the import data to identify values that cannot be automatically matched (recruiters, positions, activity types). Returns a list of unmatched values that require manual matching.',
  })
  validate(@Param('id') id: string) {
    return this.candidatesImportService.validateCandidatesImport(id);
  }

  @Post(':id/execute')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Execute the candidate import after mapping' })
  execute(
    @Param('id') id: string,
    @Body() dto: ExecuteCandidateImportDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.candidatesImportService.executeCandidatesImport(id, {
      ...dto,
      createdById: dto.createdById ?? userId,
    });
  }
}
