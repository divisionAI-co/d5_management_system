import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../../../common/decorators/public.decorator';
import { ApplicationsService } from './applications.service';
import { SubmitApplicationDto } from './dto/submit-application.dto';

@ApiTags('Recruitment - Applications')
@Controller('recruitment/applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Public()
  @Post('public')
  @UseInterceptors(FileInterceptor('cv'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Submit a job application from website (no authentication required)',
    description: 'Accepts a job application with CV upload. Creates a candidate folder in Google Drive and uploads the CV.',
  })
  @ApiResponse({
    status: 201,
    description: 'Application submitted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        candidateId: { type: 'string', format: 'uuid' },
        folderId: { type: 'string' },
        resumeUrl: { type: 'string', format: 'uri' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input or CV file format' })
  @ApiResponse({ status: 409, description: 'Candidate with this email already exists' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['firstName', 'lastName', 'email', 'cv'],
      properties: {
        firstName: {
          type: 'string',
          description: 'Candidate first name',
        },
        lastName: {
          type: 'string',
          description: 'Candidate last name',
        },
        email: {
          type: 'string',
          format: 'email',
          description: 'Candidate email address',
        },
        phone: {
          type: 'string',
          description: 'Phone number (optional)',
        },
        positionId: {
          type: 'string',
          format: 'uuid',
          description: 'Position ID to apply for (optional)',
        },
        availability: {
          type: 'string',
          format: 'date',
          description: 'Availability date - when candidate can start (optional)',
          example: '2024-02-01',
        },
        expectedNetSalary: {
          type: 'number',
          description: 'Expected net salary after taxes (optional)',
          example: 5000,
        },
        referralSource: {
          type: 'string',
          enum: ['Website', 'LinkedIn', 'Referral', 'Job Board', 'Social Media', 'Other'],
          description: 'Where the candidate heard about us (optional)',
        },
        cv: {
          type: 'string',
          format: 'binary',
          description: 'CV file (PDF, DOC, or DOCX)',
        },
      },
    },
  })
  submitApplication(
    @Body() dto: SubmitApplicationDto,
    @UploadedFile() cvFile: Express.Multer.File,
  ) {
    return this.applicationsService.submitApplication(dto, cvFile);
  }
}

