import { Controller, Get, Query, Res, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as https from 'https';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Templates')
@Controller({ path: 'templates/proxy', version: '1' })
export class GoogleDriveProxyController {
  @Public()
  @Get('google-drive-image')
  @ApiOperation({ summary: 'Proxy Google Drive images to bypass CORS restrictions (public endpoint). Returns full resolution image.' })
  @ApiQuery({ name: 'fileId', description: 'Google Drive file ID', required: true })
  async proxyGoogleDriveImage(
    @Query('fileId') fileId: string,
    @Res() res: Response,
  ) {
    if (!fileId) {
      throw new BadRequestException('fileId is required');
    }

    // Validate fileId format (alphanumeric, dash, underscore only)
    if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      throw new BadRequestException('Invalid fileId format');
    }

    // Use uc?export=view endpoint which returns the full resolution image
    const googleDriveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    const fetchImage = (url: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Too many redirects');
        return;
      }

      https.get(url, (proxyRes) => {
        // Handle redirects (301, 302, 303, 307, 308)
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          console.log(`Following redirect to: ${proxyRes.headers.location}`);
          fetchImage(proxyRes.headers.location, redirectCount + 1);
          return;
        }

        // Check if the response is successful
        if (proxyRes.statusCode !== 200) {
          res.status(HttpStatus.NOT_FOUND).send(`Image not found. Status: ${proxyRes.statusCode}. Make sure the file is shared with "Anyone with the link can view"`);
          return;
        }

        // Set appropriate headers
        res.set({
          'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          'Access-Control-Allow-Origin': '*',
        });

        // Pipe the image data to the response
        proxyRes.pipe(res);
      }).on('error', (error) => {
        console.error('Error proxying Google Drive image:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to fetch image');
      });
    };

    try {
      fetchImage(googleDriveUrl);
    } catch (error) {
      console.error('Error in Google Drive proxy:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to fetch image');
    }
  }
}

