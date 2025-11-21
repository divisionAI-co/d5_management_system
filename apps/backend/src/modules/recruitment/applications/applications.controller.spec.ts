import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { SubmitApplicationDto } from './dto/submit-application.dto';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;
  let service: ApplicationsService;

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

  const mockServiceResponse = {
    success: true,
    message: 'Application submitted successfully',
    candidateId: 'candidate-1',
    folderId: 'folder-1',
    resumeUrl: 'https://drive.google.com/file/d/file-id/view',
  };

  beforeEach(async () => {
    const mockApplicationsService = {
      submitApplication: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        {
          provide: ApplicationsService,
          useValue: mockApplicationsService,
        },
      ],
    }).compile();

    controller = module.get<ApplicationsController>(ApplicationsController);
    service = module.get<ApplicationsService>(ApplicationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('submitApplication', () => {
    it('should call service with correct parameters', async () => {
      (service.submitApplication as jest.Mock).mockResolvedValue(
        mockServiceResponse,
      );

      const result = await controller.submitApplication(mockSubmitDto, mockCvFile);

      expect(service.submitApplication).toHaveBeenCalledWith(
        mockSubmitDto,
        mockCvFile,
      );
      expect(result).toEqual(mockServiceResponse);
    });

    it('should return service response', async () => {
      (service.submitApplication as jest.Mock).mockResolvedValue(
        mockServiceResponse,
      );

      const result = await controller.submitApplication(mockSubmitDto, mockCvFile);

      expect(result).toEqual(mockServiceResponse);
    });
  });
});

