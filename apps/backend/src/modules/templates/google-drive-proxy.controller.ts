import { Controller, Get, Query, Res, HttpStatus, BadRequestException, Logger } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as https from 'https';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Templates')
@Controller({ path: 'templates/proxy', version: '1' })
export class GoogleDriveProxyController {
  private readonly logger = new Logger(GoogleDriveProxyController.name);
  @Public()
  @Get('google-drive-image')
  @ApiOperation({ summary: 'Proxy Google Drive images to bypass CORS restrictions (public endpoint). Returns original full resolution image without compression.' })
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

    // For full resolution images, we use uc?export=download which returns the original file
    // This preserves the original image quality without compression
    // For public files shared with "Anyone with the link", this works without authentication
    // Note: For very large files, Google may show a virus scan warning, which we handle below
    const googleDriveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    const fetchImage = (url: string, redirectCount = 0, isRetry = false) => {
      if (redirectCount > 5) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Too many redirects');
        return;
      }

      https.get(url, (proxyRes) => {
        // Handle redirects (301, 302, 303, 307, 308)
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          this.logger.log(`Following redirect to: ${proxyRes.headers.location}`);
          fetchImage(proxyRes.headers.location, redirectCount + 1, isRetry);
          return;
        }

        // Check if the response is successful
        if (proxyRes.statusCode !== 200) {
          res.status(HttpStatus.NOT_FOUND).send(`Image not found. Status: ${proxyRes.statusCode}. Make sure the file is shared with "Anyone with the link can view"`);
          return;
        }

        // Check if we got HTML (virus scan warning page) instead of the image
        const contentType = proxyRes.headers['content-type'] || '';
        if (contentType.includes('text/html') && !isRetry) {
          // This is likely a virus scan warning page, try to extract the download link
          let htmlData = '';
          proxyRes.on('data', (chunk) => {
            htmlData += chunk.toString();
          });
          proxyRes.on('end', () => {
            // Try to extract the confirm token from the virus scan warning page
            // The page usually contains: /uc?export=download&confirm=TOKEN&id=FILE_ID
            const confirmMatch = htmlData.match(/confirm=([a-zA-Z0-9_-]+)/);
            if (confirmMatch && confirmMatch[1] && confirmMatch[1] !== 't' && confirmMatch[1].length > 1) {
              // Use the confirm parameter to get the actual download
              const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`;
              this.logger.log(`Extracted confirm token, retrying download with token`);
              fetchImage(confirmUrl, redirectCount + 1, true);
            } else {
              // If we can't extract the token, try the direct download method
              // For images, we can also try uc?id=FILE_ID which sometimes works better
              const directUrl = `https://drive.google.com/uc?id=${fileId}`;
              this.logger.log(`Virus scan warning detected, trying direct download method`);
              fetchImage(directUrl, redirectCount + 1, true);
            }
          });
          return;
        }

        // Set appropriate headers for the image response
        res.set({
          'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          'Access-Control-Allow-Origin': '*',
        });

        // Pipe the image data to the response
        proxyRes.pipe(res);
      }).on('error', (error) => {
        this.logger.error('Error proxying Google Drive image:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to fetch image');
      });
    };

    try {
      fetchImage(googleDriveUrl);
    } catch (error) {
      this.logger.error('Error in Google Drive proxy:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to fetch image');
    }
  }
}

