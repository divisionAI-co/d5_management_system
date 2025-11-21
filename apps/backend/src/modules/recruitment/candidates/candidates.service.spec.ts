import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CandidatesService } from './candidates.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { TemplatesService } from '../../templates/templates.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { UsersService } from '../../users/users.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { UpdateCandidateStageDto } from './dto/update-candidate-stage.dto';
import { LinkCandidatePositionDto } from './dto/link-position.dto';
import { ConvertCandidateToEmployeeDto } from './dto/convert-candidate-to-employee.dto';
import { MarkInactiveDto } from './dto/mark-inactive.dto';
import { SendCandidateEmailDto } from './dto/send-email.dto';
import {
  CandidateStage,
  EmploymentStatus,
  UserRole,
} from '@prisma/client';

describe('CandidatesService', () => {
  let service: CandidatesService;
  let prismaService: any;
  let emailService: any;
  let templatesService: any;
  let notificationsService: any;
  let usersService: any;

  const mockRecruiter = {
    id: 'recruiter-1',
    firstName: 'Jane',
    lastName: 'Recruiter',
    email: 'jane@example.com',
    phone: '+1234567890',
    role: UserRole.RECRUITER,
    avatar: null,
    employee: {
      bookingLink: 'https://calendly.com/jane-recruiter',
    },
  };

  const mockCandidate = {
    id: 'candidate-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    currentTitle: 'Software Engineer',
    yearsOfExperience: 5,
    skills: ['React', 'Node.js'],
    resume: 'https://example.com/resume.pdf',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    stage: CandidateStage.VALIDATION,
    rating: 4,
    notes: 'Strong candidate',
    isActive: true,
    city: 'New York',
    country: 'USA',
    expectedSalary: new Prisma.Decimal(80000),
    salaryCurrency: 'USD',
    driveFolderId: 'folder123',
    recruiterId: 'recruiter-1',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    positions: [],
    employee: null,
    recruiter: mockRecruiter,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      candidate: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      openPosition: {
        findUnique: jest.fn(),
      },
      candidatePosition: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      employee: {
        create: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockEmailService = {
      sendEmail: jest.fn(),
    };

    const mockTemplatesService = {
      render: jest.fn(),
    };

    const mockNotificationsService = {
      createNotificationsForUsers: jest.fn(),
    };

    const mockUsersService = {
      findUsersByMentions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: TemplatesService,
          useValue: mockTemplatesService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
    prismaService = module.get(PrismaService);
    emailService = module.get(EmailService);
    templatesService = module.get(TemplatesService);
    notificationsService = module.get(NotificationsService);
    usersService = module.get(UsersService);

    // Setup transaction mock
    prismaService.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
      return callback(prismaService);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateCandidateDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      currentTitle: 'Software Engineer',
      skills: ['React', 'Node.js'],
    };

    it('should create a candidate successfully', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(null);
      prismaService.candidate.create.mockResolvedValue(mockCandidate);

      const result = await service.create(createDto, 'user-1');

      expect(result).toBeDefined();
      expect(result.firstName).toBe('John');
      expect(prismaService.candidate.create).toHaveBeenCalled();
    });

    it('should lowercase email', async () => {
      const dtoWithUppercaseEmail: CreateCandidateDto = {
        ...createDto,
        email: 'JOHN.DOE@EXAMPLE.COM',
      };

      prismaService.candidate.findUnique.mockResolvedValue(null);
      prismaService.candidate.create.mockResolvedValue(mockCandidate);

      await service.create(dtoWithUppercaseEmail, 'user-1');

      expect(prismaService.candidate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'john.doe@example.com',
          }),
        }),
      );
    });

    it('should extract Google Drive folder ID from URL', async () => {
      const dtoWithDriveUrl: CreateCandidateDto = {
        ...createDto,
        driveFolderUrl: 'https://drive.google.com/drive/folders/1A2b3C4D5E6F7G8H',
      };

      prismaService.candidate.findUnique.mockResolvedValue(null);
      prismaService.candidate.create.mockResolvedValue({
        ...mockCandidate,
        driveFolderId: '1A2b3C4D5E6F7G8H',
      });

      await service.create(dtoWithDriveUrl, 'user-1');

      expect(prismaService.candidate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driveFolderId: '1A2b3C4D5E6F7G8H',
          }),
        }),
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);

      await expect(service.create(createDto, 'user-1')).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when drive folder URL is invalid', async () => {
      const dtoWithInvalidDriveUrl: CreateCandidateDto = {
        ...createDto,
        driveFolderUrl: 'https://drive.google.com/file/d/invalid',
      };

      prismaService.candidate.findUnique.mockResolvedValue(null);

      await expect(service.create(dtoWithInvalidDriveUrl, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should validate recruiter exists', async () => {
      const dtoWithRecruiter: CreateCandidateDto = {
        ...createDto,
        recruiterId: 'recruiter-1',
      };

      prismaService.candidate.findUnique.mockResolvedValue(null);
      prismaService.user.findUnique.mockResolvedValue(mockRecruiter);
      prismaService.candidate.create.mockResolvedValue(mockCandidate);

      await service.create(dtoWithRecruiter, 'user-1');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'recruiter-1' },
        select: { id: true },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated candidates', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockCandidate]]);

      const result = await service.findAll({});

      expect(result.data).toBeDefined();
      expect(result.meta.total).toBe(1);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by stage', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockCandidate]]);

      await service.findAll({ stage: CandidateStage.VALIDATION } as any);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by positionId', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockCandidate]]);

      await service.findAll({ positionId: 'position-1' } as any);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by skills', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockCandidate]]);

      await service.findAll({ skills: ['React'] } as any);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should exclude deleted candidates by default', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockCandidate]]);

      await service.findAll({});

      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a candidate with relations', async () => {
      prismaService.candidate.findFirst.mockResolvedValue(mockCandidate);

      const result = await service.findOne('candidate-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('candidate-1');
      expect(prismaService.candidate.findFirst).toHaveBeenCalled();
    });

    it('should format expectedSalary as number', async () => {
      prismaService.candidate.findFirst.mockResolvedValue(mockCandidate);

      const result = await service.findOne('candidate-1');

      expect(typeof result.expectedSalary).toBe('number');
    });

    it('should generate driveFolderUrl from driveFolderId', async () => {
      prismaService.candidate.findFirst.mockResolvedValue(mockCandidate);

      const result = await service.findOne('candidate-1');

      expect(result.driveFolderUrl).toBe('https://drive.google.com/drive/folders/folder123');
    });

    it('should throw NotFoundException when candidate does not exist', async () => {
      prismaService.candidate.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateCandidateDto = {
      firstName: 'Jane',
      lastName: 'Smith',
    };

    it('should update a candidate successfully', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.update.mockResolvedValue({
        ...mockCandidate,
        ...updateDto,
      });

      const result = await service.update('candidate-1', updateDto, 'user-1');

      expect(result).toBeDefined();
      expect(result.firstName).toBe('Jane');
      expect(prismaService.candidate.update).toHaveBeenCalled();
    });

    it('should handle drive folder URL update', async () => {
      const updateWithDriveUrl: UpdateCandidateDto = {
        driveFolderUrl: 'https://drive.google.com/drive/folders/newFolderId',
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.update.mockResolvedValue({
        ...mockCandidate,
        driveFolderId: 'newFolderId',
      });

      await service.update('candidate-1', updateWithDriveUrl, 'user-1');

      expect(prismaService.candidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driveFolderId: 'newFolderId',
          }),
        }),
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.update.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['email'] },
      });

      const updateWithEmail: UpdateCandidateDto = {
        email: 'existing@example.com',
      };

      await expect(service.update('candidate-1', updateWithEmail, 'user-1')).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when candidate does not exist', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto, 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStage', () => {
    const stageDto: UpdateCandidateStageDto = {
      stage: CandidateStage.TECHNICAL_INTERVIEW,
      note: 'Passed validation',
    };

    it('should update candidate stage successfully', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.update.mockResolvedValue({
        ...mockCandidate,
        stage: CandidateStage.TECHNICAL_INTERVIEW,
      });

      const result = await service.updateStage('candidate-1', stageDto);

      expect(result).toBeDefined();
      expect(result.stage).toBe(CandidateStage.TECHNICAL_INTERVIEW);
      expect(prismaService.candidate.update).toHaveBeenCalled();
    });

    it('should mark candidate as inactive when rejected', async () => {
      const rejectDto: UpdateCandidateStageDto = {
        stage: CandidateStage.REJECTED,
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.update.mockResolvedValue({
        ...mockCandidate,
        stage: CandidateStage.REJECTED,
        isActive: false,
      });

      await service.updateStage('candidate-1', rejectDto);

      expect(prismaService.candidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: CandidateStage.REJECTED,
            isActive: false,
          }),
        }),
      );
    });

    it('should append note to existing notes', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.update.mockResolvedValue(mockCandidate);

      await service.updateStage('candidate-1', stageDto);

      expect(prismaService.candidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: expect.stringContaining('Passed validation'),
          }),
        }),
      );
    });
  });

  describe('linkToPosition', () => {
    const linkDto: LinkCandidatePositionDto = {
      positionId: 'position-1',
      status: 'Under Review',
      notes: 'Initial review',
    };

    it('should link candidate to position successfully', async () => {
      const mockPosition = {
        id: 'position-1',
        title: 'Senior Developer',
        opportunity: null,
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.candidatePosition.upsert.mockResolvedValue({
        candidateId: 'candidate-1',
        positionId: 'position-1',
      });
      prismaService.candidate.findUnique.mockResolvedValueOnce(mockCandidate).mockResolvedValueOnce(mockCandidate);

      const result = await service.linkToPosition('candidate-1', linkDto);

      expect(result).toBeDefined();
      expect(prismaService.candidatePosition.upsert).toHaveBeenCalled();
    });

    it('should throw NotFoundException when position does not exist', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.openPosition.findUnique.mockResolvedValue(null);

      await expect(service.linkToPosition('candidate-1', linkDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when already linked', async () => {
      const mockPosition = {
        id: 'position-1',
        title: 'Senior Developer',
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.candidatePosition.upsert.mockRejectedValue({
        code: 'P2002',
      });

      await expect(service.linkToPosition('candidate-1', linkDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('unlinkPosition', () => {
    it('should unlink candidate from position successfully', async () => {
      const mockLink = {
        candidateId: 'candidate-1',
        positionId: 'position-1',
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidatePosition.findUnique.mockResolvedValue(mockLink);
      prismaService.candidatePosition.delete.mockResolvedValue(mockLink);
      prismaService.candidate.findUnique.mockResolvedValueOnce(mockCandidate).mockResolvedValueOnce(mockCandidate);

      const result = await service.unlinkPosition('candidate-1', 'position-1');

      expect(result).toBeDefined();
      expect(prismaService.candidatePosition.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when link does not exist', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidatePosition.findUnique.mockResolvedValue(null);

      await expect(service.unlinkPosition('candidate-1', 'position-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('convertToEmployee', () => {
    const convertDto: ConvertCandidateToEmployeeDto = {
      employeeNumber: 'EMP001',
      department: 'Engineering',
      jobTitle: 'Software Engineer',
      hireDate: '2024-01-01',
      salary: 80000,
      salaryCurrency: 'USD',
      contractType: 'FULL_TIME' as any,
    };

    it('should convert candidate to employee successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.EMPLOYEE,
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);
      prismaService.employee.create.mockResolvedValue({
        id: 'employee-1',
        userId: 'user-1',
        candidateId: 'candidate-1',
      });
      prismaService.candidate.update.mockResolvedValue({
        ...mockCandidate,
        stage: CandidateStage.HIRED,
      });

      const result = await service.convertToEmployee('candidate-1', convertDto);

      expect(result).toBeDefined();
      expect(result.employee).toBeDefined();
      expect(result.candidate.stage).toBe(CandidateStage.HIRED);
      expect(result.temporaryPassword).toBeDefined();
    });

    it('should use existing user when email matches', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.EMPLOYEE,
        employee: null,
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.user.findUnique.mockResolvedValue(existingUser);
      prismaService.employee.create.mockResolvedValue({
        id: 'employee-1',
        userId: 'user-1',
      });
      prismaService.candidate.update.mockResolvedValue({
        ...mockCandidate,
        stage: CandidateStage.HIRED,
      });

      const result = await service.convertToEmployee('candidate-1', convertDto);

      expect(result).toBeDefined();
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when candidate already has employee', async () => {
      const candidateWithEmployee = {
        ...mockCandidate,
        employee: {
          id: 'employee-1',
        },
      };

      prismaService.candidate.findUnique.mockResolvedValue(candidateWithEmployee);

      await expect(service.convertToEmployee('candidate-1', convertDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when user already has employee', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'john.doe@example.com',
        employee: {
          id: 'employee-1',
        },
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.user.findUnique.mockResolvedValue(existingUser);

      const convertWithUserId: ConvertCandidateToEmployeeDto = {
        ...convertDto,
        userId: 'user-1',
      };

      await expect(service.convertToEmployee('candidate-1', convertWithUserId)).rejects.toThrow(ConflictException);
    });
  });

  describe('getPositions', () => {
    it('should return candidate positions', async () => {
      const mockPositions = [
        {
          id: 'link-1',
          candidateId: 'candidate-1',
          positionId: 'position-1',
          appliedAt: new Date(),
          position: {
            id: 'position-1',
            title: 'Senior Developer',
            opportunity: null,
          },
        },
      ];

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidatePosition.findMany.mockResolvedValue(mockPositions);

      const result = await service.getPositions('candidate-1');

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(prismaService.candidatePosition.findMany).toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive a candidate successfully', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.update.mockResolvedValue({
        ...mockCandidate,
        deletedAt: new Date(),
      });

      const result = await service.archive('candidate-1');

      expect(result).toBeDefined();
      expect(result.deletedAt).toBeDefined();
      expect(prismaService.candidate.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when candidate is already archived', async () => {
      const archivedCandidate = {
        ...mockCandidate,
        deletedAt: new Date(),
      };

      prismaService.candidate.findUnique.mockResolvedValue(archivedCandidate);

      await expect(service.archive('candidate-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('restore', () => {
    it('should restore an archived candidate', async () => {
      const archivedCandidate = {
        ...mockCandidate,
        deletedAt: new Date(),
      };

      prismaService.candidate.findUnique.mockResolvedValue(archivedCandidate);
      prismaService.candidate.update.mockResolvedValue({
        ...archivedCandidate,
        deletedAt: null,
      });

      const result = await service.restore('candidate-1');

      expect(result).toBeDefined();
      expect(result.deletedAt).toBeNull();
    });

    it('should throw BadRequestException when candidate is not archived', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);

      await expect(service.restore('candidate-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('markInactive', () => {
    const markInactiveDto: MarkInactiveDto = {
      reason: 'No longer interested',
      sendEmail: false,
    };

    it('should mark candidate as inactive', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.update.mockResolvedValue({
        ...mockCandidate,
        isActive: false,
      });

      const result = await service.markInactive('candidate-1', markInactiveDto);

      expect(result).toBeDefined();
      expect(result.isActive).toBe(false);
    });

    it('should send email when requested', async () => {
      const dtoWithEmail: MarkInactiveDto = {
        ...markInactiveDto,
        sendEmail: true,
        emailSubject: 'Update on Application',
        emailBody: '<p>Thank you for your interest</p>',
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.update.mockResolvedValue({
        ...mockCandidate,
        isActive: false,
      });
      emailService.sendEmail.mockResolvedValue(true);

      await service.markInactive('candidate-1', dtoWithEmail);

      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('should use template when templateId provided', async () => {
      const dtoWithTemplate: MarkInactiveDto = {
        ...markInactiveDto,
        sendEmail: true,
        templateId: 'template-1',
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.update.mockResolvedValue({
        ...mockCandidate,
        isActive: false,
      });
      templatesService.render.mockResolvedValue({
        html: '<p>Template content</p>',
      });
      emailService.sendEmail.mockResolvedValue(true);

      await service.markInactive('candidate-1', dtoWithTemplate);

      expect(templatesService.render).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a candidate successfully', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      prismaService.candidate.delete.mockResolvedValue(mockCandidate);

      const result = await service.delete('candidate-1');

      expect(result.success).toBe(true);
      expect(prismaService.candidate.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException when candidate is linked to employee', async () => {
      const candidateWithEmployee = {
        ...mockCandidate,
        employee: {
          id: 'employee-1',
        },
      };

      prismaService.candidate.findUnique.mockResolvedValue(candidateWithEmployee);

      await expect(service.delete('candidate-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendEmail', () => {
    const sendEmailDto: SendCandidateEmailDto = {
      to: 'john.doe@example.com',
      subject: 'Interview Invitation',
      htmlContent: '<p>You are invited for an interview</p>',
    };

    it('should send email successfully', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      emailService.sendEmail.mockResolvedValue(true);

      const result = await service.sendEmail('candidate-1', sendEmailDto);

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('should render template when templateId provided', async () => {
      const dtoWithTemplate: SendCandidateEmailDto = {
        ...sendEmailDto,
        templateId: 'template-1',
        htmlContent: undefined,
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      templatesService.render.mockResolvedValue({
        html: '<p>Template content</p>',
        text: 'Template content',
      });
      emailService.sendEmail.mockResolvedValue(true);

      await service.sendEmail('candidate-1', dtoWithTemplate);

      expect(templatesService.render).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          recruiter: expect.objectContaining({
            id: 'recruiter-1',
            firstName: 'Jane',
            lastName: 'Recruiter',
            fullName: 'Jane Recruiter',
            email: 'jane@example.com',
            phone: '+1234567890',
            role: UserRole.RECRUITER,
            avatar: null,
            bookingLink: 'https://calendly.com/jane-recruiter',
          }),
        }),
      );
    });

    it('should handle recruiter without employee record (bookingLink null)', async () => {
      const candidateWithoutEmployee = {
        ...mockCandidate,
        recruiter: {
          ...mockRecruiter,
          employee: null,
        },
      };

      const dtoWithTemplate: SendCandidateEmailDto = {
        ...sendEmailDto,
        templateId: 'template-1',
        htmlContent: undefined,
      };

      prismaService.candidate.findUnique.mockResolvedValue(candidateWithoutEmployee);
      templatesService.render.mockResolvedValue({
        html: '<p>Template content</p>',
        text: 'Template content',
      });
      emailService.sendEmail.mockResolvedValue(true);

      await service.sendEmail('candidate-1', dtoWithTemplate);

      expect(templatesService.render).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          recruiter: expect.objectContaining({
            bookingLink: null,
          }),
        }),
      );
    });

    it('should throw BadRequestException when email sending fails', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      emailService.sendEmail.mockResolvedValue(false);

      await expect(service.sendEmail('candidate-1', sendEmailDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when candidate does not exist', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(null);

      await expect(service.sendEmail('non-existent', sendEmailDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listRecruiters', () => {
    it('should return list of recruiters', async () => {
      const recruiters = [mockRecruiter];
      prismaService.user.findMany.mockResolvedValue(recruiters);

      const result = await service.listRecruiters();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: expect.objectContaining({
              in: [UserRole.RECRUITER, UserRole.HR, UserRole.ADMIN],
            }),
          }),
        }),
      );
    });
  });
});

