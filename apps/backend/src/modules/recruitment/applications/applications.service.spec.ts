import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { GoogleDriveService } from '../../integrations/google-drive/google-drive.service';
import { SubmitApplicationDto } from './dto/submit-application.dto';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prismaService: any;
  let googleDriveService: any;
  let configService: any;

  const mockCvFile: Express.Multer.File = {
    fieldname: 'cv',
    originalname: 'resume.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('fake pdf content'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  const mockSubmitDto: SubmitApplicationDto = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    positionId: 'position-1',
  };

  const mockRecruitmentFolder = {
    id: 'recruitment-folder-id',
    name: 'Recruitment',
    isFolder: true,
  };

  const mockCandidateFolder = {
    id: 'candidate-folder-id',
    name: 'J_D',
    isFolder: true,
  };

  const mockUploadedFile = {
    id: 'file-id',
    name: 'resume.pdf',
    webViewLink: 'https://drive.google.com/file/d/file-id/view',
    isFolder: false,
  };

  const mockCandidate = {
    id: 'candidate-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    resume: 'https://drive.google.com/file/d/file-id/view',
    driveFolderId: 'candidate-folder-id',
    stage: 'VALIDATION',
    isActive: true,
  };

  const mockPosition = {
    id: 'position-1',
    title: 'Senior Developer',
    status: 'Open',
    isArchived: false,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      candidate: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      openPosition: {
        findUnique: jest.fn(),
      },
      candidatePosition: {
        create: jest.fn(),
      },
    };

    const mockGoogleDriveService = {
      getFileMetadata: jest.fn(),
      createFolder: jest.fn(),
      uploadFile: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: GoogleDriveService,
          useValue: mockGoogleDriveService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    prismaService = module.get(PrismaService);
    googleDriveService = module.get(GoogleDriveService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('submitApplication', () => {
    beforeEach(() => {
      // Default mocks
      configService.get.mockImplementation((key: string) => {
        if (key === 'GOOGLE_DRIVE_RECRUITMENT_FOLDER_ID') {
          return 'recruitment-folder-id';
        }
        if (key === 'GOOGLE_DRIVE_SHARED_DRIVE_ID') {
          return 'shared-drive-id';
        }
        return null;
      });

      prismaService.candidate.findUnique.mockResolvedValue(null);
      googleDriveService.getFileMetadata.mockResolvedValue(mockRecruitmentFolder);
      googleDriveService.createFolder.mockResolvedValue(mockCandidateFolder);
      googleDriveService.uploadFile.mockResolvedValue(mockUploadedFile);
      prismaService.candidate.create.mockResolvedValue(mockCandidate);
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.candidatePosition.create.mockResolvedValue({});
    });

    it('should throw BadRequestException if CV file is missing', async () => {
      await expect(
        service.submitApplication(mockSubmitDto, null as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.submitApplication(mockSubmitDto, null as any),
      ).rejects.toThrow('CV file is required');
    });

    it('should throw BadRequestException for invalid file types', async () => {
      const invalidFile = {
        ...mockCvFile,
        mimetype: 'image/jpeg',
      };

      await expect(
        service.submitApplication(mockSubmitDto, invalidFile),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.submitApplication(mockSubmitDto, invalidFile),
      ).rejects.toThrow('CV must be a PDF or Word document');
    });

    it('should accept PDF files', async () => {
      const result = await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(result.success).toBe(true);
      expect(result.candidateId).toBe('candidate-1');
    });

    it('should accept DOC files', async () => {
      const docFile = {
        ...mockCvFile,
        mimetype: 'application/msword',
      };

      const result = await service.submitApplication(mockSubmitDto, docFile);

      expect(result.success).toBe(true);
    });

    it('should accept DOCX files', async () => {
      const docxFile = {
        ...mockCvFile,
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

      const result = await service.submitApplication(mockSubmitDto, docxFile);

      expect(result.success).toBe(true);
    });

    it('should throw ConflictException if candidate already exists', async () => {
      prismaService.candidate.findUnique.mockResolvedValue({
        id: 'existing-candidate',
        email: 'john.doe@example.com',
      });

      await expect(
        service.submitApplication(mockSubmitDto, mockCvFile),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.submitApplication(mockSubmitDto, mockCvFile),
      ).rejects.toThrow('A candidate with this email already exists');
    });

    it('should get or create recruitment folder', async () => {
      await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(googleDriveService.getFileMetadata).toHaveBeenCalledWith(
        'recruitment-folder-id',
      );
    });

    it('should create recruitment folder if not found', async () => {
      configService.get.mockReturnValue(null);
      googleDriveService.getFileMetadata.mockRejectedValue(
        new Error('Not found'),
      );

      await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(googleDriveService.createFolder).toHaveBeenCalledWith(
        'Recruitment',
        'shared-drive-id',
      );
    });

    it('should create candidate folder with F_L format', async () => {
      await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(googleDriveService.createFolder).toHaveBeenCalledWith(
        'J_D',
        'recruitment-folder-id',
      );
    });

    it('should upload CV to candidate folder', async () => {
      await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(googleDriveService.uploadFile).toHaveBeenCalledWith(
        mockCvFile,
        'candidate-folder-id',
      );
    });

    it('should create candidate record with correct data', async () => {
      await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(prismaService.candidate.create).toHaveBeenCalledWith({
        data: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1234567890',
          resume: 'https://drive.google.com/file/d/file-id/view',
          driveFolderId: 'candidate-folder-id',
          stage: 'VALIDATION',
          isActive: true,
        },
      });
    });

    it('should link candidate to position if positionId provided', async () => {
      await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(prismaService.openPosition.findUnique).toHaveBeenCalledWith({
        where: { id: 'position-1' },
      });
      expect(prismaService.candidatePosition.create).toHaveBeenCalledWith({
        data: {
          candidateId: 'candidate-1',
          positionId: 'position-1',
          status: 'Under Review',
        },
      });
    });

    it('should not link to position if positionId not provided', async () => {
      const dtoWithoutPosition = {
        ...mockSubmitDto,
        positionId: undefined,
      };

      await service.submitApplication(dtoWithoutPosition, mockCvFile);

      expect(prismaService.openPosition.findUnique).not.toHaveBeenCalled();
      expect(prismaService.candidatePosition.create).not.toHaveBeenCalled();
    });

    it('should not link to position if position does not exist', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(null);

      await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(prismaService.candidatePosition.create).not.toHaveBeenCalled();
    });

    it('should not link to position if position is not open', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue({
        ...mockPosition,
        status: 'Filled',
      });

      await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(prismaService.candidatePosition.create).not.toHaveBeenCalled();
    });

    it('should not link to position if position is archived', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue({
        ...mockPosition,
        isArchived: true,
      });

      await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(prismaService.candidatePosition.create).not.toHaveBeenCalled();
    });

    it('should return success response with candidate and folder info', async () => {
      const result = await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(result).toEqual({
        success: true,
        message: 'Application submitted successfully',
        candidateId: 'candidate-1',
        folderId: 'candidate-folder-id',
        resumeUrl: 'https://drive.google.com/file/d/file-id/view',
      });
    });

    it('should handle Google Drive errors gracefully', async () => {
      googleDriveService.createFolder.mockRejectedValue(
        new Error('Drive API error'),
      );

      await expect(
        service.submitApplication(mockSubmitDto, mockCvFile),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle database errors gracefully', async () => {
      prismaService.candidate.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.submitApplication(mockSubmitDto, mockCvFile),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should use webViewLink for resume URL if available', async () => {
      const fileWithWebViewLink = {
        ...mockUploadedFile,
        webViewLink: 'https://drive.google.com/file/d/file-id/view',
      };
      googleDriveService.uploadFile.mockResolvedValue(fileWithWebViewLink);

      await service.submitApplication(mockSubmitDto, mockCvFile);

      expect(prismaService.candidate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resume: 'https://drive.google.com/file/d/file-id/view',
        }),
      });
    });

    it('should generate folder name correctly for different names', () => {
      const generateFolderName = (service as any).generateFolderName;

      expect(generateFolderName('John', 'Doe')).toBe('J_D');
      expect(generateFolderName('Mary', 'Jane')).toBe('M_J');
      expect(generateFolderName('A', 'B')).toBe('A_B');
      expect(generateFolderName('  Alice  ', '  Bob  ')).toBe('A_B');
    });
  });
});

