import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { GoogleDriveService } from './google-drive.service';
import { ListDriveFilesDto } from './dto/list-drive-files.dto';
import { UpdateDriveFileDto } from './dto/update-drive-file.dto';

@ApiTags('Integrations - Google Drive')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drive')
export class GoogleDriveController {
  constructor(private readonly googleDriveService: GoogleDriveService) {}

  @Get('files')
  @ApiOperation({ summary: 'List files in Google Drive shared drive/folder' })
  listFiles(@Query() query: ListDriveFilesDto) {
    return this.googleDriveService.listFiles(query);
  }

  @Get('files/:id')
  @ApiOperation({ summary: 'Get Google Drive file metadata' })
  getFile(@Param('id') id: string) {
    return this.googleDriveService.getFileMetadata(id);
  }

  @Public()
  @Get('files/:id/content')
  @ApiOperation({ summary: 'Download file contents from Google Drive' })
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    const { stream, file } = await this.googleDriveService.downloadFile(id);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.name)}"`,
    );

    stream.on('error', (error) => {
      res.destroy(error);
    });

    stream.pipe(res);
  }

  @Post('files')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        parentId: { type: 'string', nullable: true },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a new file to Google Drive' })
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('parentId') parentId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required for upload.');
    }

    return this.googleDriveService.uploadFile(file, parentId);
  }

  @Patch('files/:id')
  @ApiOperation({ summary: 'Update Google Drive file metadata' })
  renameFile(@Param('id') id: string, @Body() dto: UpdateDriveFileDto) {
    return this.googleDriveService.renameFile(id, dto.name);
  }

  @Delete('files/:id')
  @ApiOperation({ summary: 'Delete a file from Google Drive' })
  async deleteFile(@Param('id') id: string) {
    await this.googleDriveService.deleteFile(id);
    return { success: true };
  }
}



