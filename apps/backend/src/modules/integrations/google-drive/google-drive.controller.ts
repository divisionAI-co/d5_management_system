import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { GoogleDriveService } from './google-drive.service';
import { ListDriveFilesDto } from './dto/list-drive-files.dto';
import { UpdateDriveFileDto } from './dto/update-drive-file.dto';

@ApiTags('Integrations - Google Drive')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drive')
export class GoogleDriveController {
  constructor(private readonly googleDriveService: GoogleDriveService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get Google Drive connection status for current user' })
  getConnectionStatus(@CurrentUser('id') userId: string) {
    return this.googleDriveService.getConnectionStatus(userId);
  }

  @Get('connect')
  @ApiOperation({ summary: 'Generate Google Drive OAuth authorization URL' })
  generateAuthUrl(@Query('redirectUri') redirectUri?: string, @Query('state') state?: string) {
    return this.googleDriveService.generateAuthUrl(redirectUri, state);
  }

  @Post('connect/callback')
  @ApiOperation({ summary: 'Exchange OAuth code for access tokens' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string', description: 'OAuth authorization code from Google' },
        redirectUri: { type: 'string', description: 'Redirect URI used in the OAuth flow' },
      },
    },
  })
  async exchangeCode(
    @CurrentUser('id') userId: string,
    @Body('code') code: string,
    @Body('redirectUri') redirectUri?: string,
  ) {
    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }
    return this.googleDriveService.exchangeCode(userId, code, redirectUri);
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect Google Drive integration for current user' })
  disconnect(@CurrentUser('id') userId: string) {
    return this.googleDriveService.disconnect(userId);
  }

  @Get('files')
  @ApiOperation({ summary: 'List files in Google Drive shared drive/folder' })
  async listFiles(
    @Query() query: ListDriveFilesDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail?: string,
  ) {
    return this.googleDriveService.listFiles(
      {
        ...query,
        userEmail, // Filter files by current user's permissions
      },
      userId, // Use user's OAuth tokens if available
    );
  }

  @Get('files/:id')
  @ApiOperation({ summary: 'Get Google Drive file metadata' })
  async getFile(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail?: string,
  ) {
    const file = await this.googleDriveService.getFileMetadata(id, userId);
    
    // Check if user has permission to view this file
    if (userEmail) {
      try {
        const userPerms = await this.googleDriveService.getUserFilePermissions(id, userEmail, userId);
        if (!userPerms.canView) {
          throw new NotFoundException('File not found or you do not have permission to view it.');
        }
      } catch (error: any) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        // If permission check fails, still allow access (might be a service account issue)
        // but log the warning
        this.googleDriveService['logger']?.warn(`Could not verify permissions for file ${id}`);
      }
    }
    
    return file;
  }

  @Get('files/:id/content')
  @ApiOperation({ summary: 'Download file contents from Google Drive' })
  async downloadFile(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string,
    @Res() res: Response,
  ) {
    // Check if user has permission to view/download this file
    if (userEmail) {
      try {
        const userPerms = await this.googleDriveService.getUserFilePermissions(id, userEmail, userId);
        if (!userPerms.canView) {
          throw new NotFoundException('File not found or you do not have permission to view it.');
        }
      } catch (error: any) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        this.googleDriveService['logger']?.warn(`Could not verify permissions for file ${id}`);
      }
    }
    const { stream, file } = await this.googleDriveService.downloadFile(id, userId);
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
    @CurrentUser('id') userId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required for upload.');
    }

    return this.googleDriveService.uploadFile(file, parentId, userId);
  }

  @Patch('files/:id')
  @ApiOperation({ summary: 'Update Google Drive file metadata' })
  async renameFile(
    @Param('id') id: string,
    @Body() dto: UpdateDriveFileDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string,
  ) {
    // Check if user has permission to edit this file
    if (userEmail) {
      try {
        const userPerms = await this.googleDriveService.getUserFilePermissions(id, userEmail, userId);
        if (!userPerms.canEdit) {
          throw new BadRequestException('You do not have permission to edit this file.');
        }
      } catch (error: any) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.googleDriveService['logger']?.warn(`Could not verify permissions for file ${id}`);
      }
    }
    return this.googleDriveService.renameFile(id, dto.name, userId);
  }

  @Delete('files/:id')
  @ApiOperation({ summary: 'Delete a file from Google Drive' })
  async deleteFile(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('email') userEmail: string) {
    // Check if user has permission to delete this file
    if (userEmail) {
      try {
        const userPerms = await this.googleDriveService.getUserFilePermissions(id, userEmail, userId);
        if (!userPerms.canDelete) {
          throw new BadRequestException('You do not have permission to delete this file.');
        }
      } catch (error: any) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.googleDriveService['logger']?.warn(`Could not verify permissions for file ${id}`);
      }
    }
    await this.googleDriveService.deleteFile(id, userId);
    return { success: true };
  }

  @Get('files/:id/permissions')
  @ApiOperation({ summary: 'Get all permissions for a Google Drive file/folder' })
  getFilePermissions(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    return this.googleDriveService.getFilePermissions(id, userId);
  }

  @Get('files/:id/permissions/me')
  @ApiOperation({
    summary: 'Get permissions for the current authenticated user on a Google Drive file/folder',
    description: 'Returns detailed permission information for the logged-in user',
  })
  getMyFilePermissions(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string,
  ) {
    if (!userEmail) {
      throw new BadRequestException('User email not found in token');
    }
    return this.googleDriveService.getUserFilePermissions(id, userEmail, userId);
  }

  @Get('files/:id/permissions/user')
  @ApiOperation({
    summary: 'Get permissions for a specific user on a Google Drive file/folder',
    description: 'Returns detailed permission information including what actions the user can perform',
  })
  getUserFilePermissions(
    @Param('id') id: string,
    @Query('email') userEmail: string,
    @CurrentUser('id') userId?: string,
  ) {
    if (!userEmail) {
      throw new BadRequestException('User email is required (query parameter: email)');
    }
    return this.googleDriveService.getUserFilePermissions(id, userEmail, userId);
  }

  @Get('files/:id/permissions/check')
  @ApiOperation({
    summary: 'Check if a user has a specific permission role on a file',
    description: 'Returns true if the user has the required role or higher',
  })
  checkUserPermission(
    @Param('id') id: string,
    @Query('email') userEmail: string,
    @Query('role') requiredRole: string,
    @CurrentUser('id') userId?: string,
  ) {
    if (!userEmail) {
      throw new BadRequestException('User email is required (query parameter: email)');
    }
    if (!requiredRole) {
      throw new BadRequestException('Required role is required (query parameter: role)');
    }

    const validRoles = ['owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader'];
    if (!validRoles.includes(requiredRole)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    return this.googleDriveService.checkUserPermission(id, userEmail, requiredRole as any, userId);
  }
}



