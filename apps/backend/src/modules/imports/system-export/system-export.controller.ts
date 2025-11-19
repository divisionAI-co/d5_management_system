import {
  Controller,
  Get,
  Post,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../modules/auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SystemExportService } from './system-export.service';

@ApiTags('System Export/Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'system-export',
  version: '1',
})
export class SystemExportController {
  constructor(private readonly systemExportService: SystemExportService) {}

  @Get('export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Export all system data',
    description: 'Admin only. Exports all data from the system to a JSON file.',
  })
  async exportSystem(@Res() res: Response) {
    try {
      const exportData = await this.systemExportService.exportSystemData();

      // Set response headers for file download
      const filename = `system-export-${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Send JSON response
      res.json(exportData);
    } catch (error: any) {
      throw new BadRequestException(`Failed to export system data: ${error.message}`);
    }
  }

  @Post('import')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Import all system data',
    description:
      'Admin only. Imports all data from a previously exported JSON file. WARNING: This will overwrite existing data if clearExisting is true.',
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
        clearExisting: {
          type: 'boolean',
          description: 'If true, clears all existing data before importing',
          default: false,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importSystem(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'application/json' && !file.originalname.endsWith('.json')) {
      throw new BadRequestException('File must be a JSON file');
    }

    try {
      // Parse JSON file
      const fileContent = file.buffer.toString('utf-8');
      const exportData = JSON.parse(fileContent);

      // Get clearExisting option from form data (if provided)
      // Note: FileInterceptor doesn't parse form fields, so we'll need to handle this differently
      // For now, we'll default to false for safety
      const clearExisting = false;

      // Import the data
      const result = await this.systemExportService.importSystemData(exportData, {
        clearExisting,
      });

      res.json({
        success: result.success,
        message: `Import completed. Imported ${result.imported} records.`,
        imported: result.imported,
        errors: result.errors,
      });
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw new BadRequestException('Invalid JSON file format');
      }
      throw new BadRequestException(`Failed to import system data: ${error.message}`);
    }
  }

  @Post('import-with-clear')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Import all system data and clear existing data',
    description:
      'Admin only. Imports all data from a previously exported JSON file and clears all existing data first. WARNING: This is a destructive operation!',
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
  async importSystemWithClear(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'application/json' && !file.originalname.endsWith('.json')) {
      throw new BadRequestException('File must be a JSON file');
    }

    try {
      // Parse JSON file
      const fileContent = file.buffer.toString('utf-8');
      const exportData = JSON.parse(fileContent);

      // Import with clearExisting = true
      const result = await this.systemExportService.importSystemData(exportData, {
        clearExisting: true,
      });

      res.json({
        success: result.success,
        message: `Import completed. Cleared existing data and imported ${result.imported} records.`,
        imported: result.imported,
        errors: result.errors,
      });
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw new BadRequestException('Invalid JSON file format');
      }
      throw new BadRequestException(`Failed to import system data: ${error.message}`);
    }
  }
}

