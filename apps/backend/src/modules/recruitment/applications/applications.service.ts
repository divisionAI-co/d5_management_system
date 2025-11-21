import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { GoogleDriveService } from '../../integrations/google-drive/google-drive.service';
import { SubmitApplicationDto } from './dto/submit-application.dto';

@Injectable()
export class ApplicationsService extends BaseService {
  constructor(
    prisma: PrismaService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly configService: ConfigService,
  ) {
    super(prisma);
  }

  /**
   * Generate folder name from candidate name (format: F_L)
   * Example: "John Doe" -> "J_D"
   */
  private generateFolderName(firstName: string, lastName: string): string {
    const firstInitial = firstName.trim().charAt(0).toUpperCase();
    const lastInitial = lastName.trim().charAt(0).toUpperCase();
    return `${firstInitial}_${lastInitial}`;
  }

  /**
   * Get or create recruitment folder in Google Drive
   */
  private async getOrCreateRecruitmentFolder(): Promise<string> {
    const recruitmentFolderId = this.configService.get<string>('GOOGLE_DRIVE_RECRUITMENT_FOLDER_ID');
    
    if (recruitmentFolderId) {
      // Verify folder exists
      try {
        await this.googleDriveService.getFileMetadata(recruitmentFolderId);
        return recruitmentFolderId;
      } catch (error) {
        this.logger.warn(`Recruitment folder ${recruitmentFolderId} not found, will create new one`);
      }
    }

    // Create recruitment folder if it doesn't exist
    // This uses the shared drive root or creates in root
    const sharedDriveId = this.configService.get<string>('GOOGLE_DRIVE_SHARED_DRIVE_ID');
    const recruitmentFolder = await this.googleDriveService.createFolder('Recruitment', sharedDriveId);
    
    this.logger.log(`Created recruitment folder: ${recruitmentFolder.id}`);
    return recruitmentFolder.id;
  }

  /**
   * Submit a job application from the website
   * Creates candidate folder, uploads CV, and creates candidate record
   */
  async submitApplication(
    dto: SubmitApplicationDto,
    cvFile: Express.Multer.File,
  ) {
    if (!cvFile) {
      throw new BadRequestException('CV file is required');
    }

    // Validate file type (PDF, DOC, DOCX)
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedMimeTypes.includes(cvFile.mimetype)) {
      throw new BadRequestException(
        'CV must be a PDF or Word document (.pdf, .doc, .docx)',
      );
    }

    // Check if candidate already exists
    const existingCandidate = await this.prisma.candidate.findUnique({
      where: { email: dto.email },
    });

    if (existingCandidate) {
      throw new ConflictException(
        'A candidate with this email already exists. Please contact us directly.',
      );
    }

    try {
      // Get or create recruitment folder
      const recruitmentFolderId = await this.getOrCreateRecruitmentFolder();

      // Generate folder name (F_L format)
      const folderName = this.generateFolderName(dto.firstName, dto.lastName);

      // Create candidate folder in recruitment folder
      const candidateFolder = await this.googleDriveService.createFolder(
        folderName,
        recruitmentFolderId,
      );

      this.logger.log(`Created candidate folder: ${candidateFolder.id} (${folderName})`);

      // Upload CV to candidate folder
      const uploadedFile = await this.googleDriveService.uploadFile(
        cvFile,
        candidateFolder.id,
      );

      this.logger.log(`Uploaded CV: ${uploadedFile.id} (${uploadedFile.name})`);

      // Get position title if positionId is provided
      let positionTitle: string | undefined;
      if (dto.positionId) {
        const position = await this.prisma.openPosition.findUnique({
          where: { id: dto.positionId },
          select: { title: true, status: true, isArchived: true },
        });

        if (position && position.status === 'Open' && !position.isArchived) {
          positionTitle = position.title;
        } else if (position) {
          this.logger.warn(`Position ${dto.positionId} is not open or is archived, skipping title and link`);
        } else {
          this.logger.warn(`Position ${dto.positionId} not found, skipping title and link`);
        }
      }

      // Create candidate record
      const candidate = await this.prisma.candidate.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          resume: uploadedFile.webViewLink || `https://drive.google.com/file/d/${uploadedFile.id}/view`,
          driveFolderId: candidateFolder.id,
          stage: 'VALIDATION',
          isActive: true,
          // New fields
          availableFrom: dto.availability ? new Date(dto.availability) : undefined,
          expectedSalary: dto.expectedNetSalary ? dto.expectedNetSalary : undefined,
          referralSource: dto.referralSource || undefined,
          // Set title from position if available
          currentTitle: positionTitle,
        },
      });

      // Link to position if provided and position is valid
      if (dto.positionId && positionTitle) {
        // Position was already validated above, create link
        await this.prisma.candidatePosition.create({
          data: {
            candidateId: candidate.id,
            positionId: dto.positionId,
            status: 'Under Review',
          },
        });
        this.logger.log(`Linked candidate to position: ${dto.positionId} with title: ${positionTitle}`);
      }

      return {
        success: true,
        message: 'Application submitted successfully',
        candidateId: candidate.id,
        folderId: candidateFolder.id,
        resumeUrl: candidate.resume,
      };
    } catch (error: any) {
      this.logger.error('Failed to submit application', error);
      
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to submit application. Please try again later.',
      );
    }
  }
}

