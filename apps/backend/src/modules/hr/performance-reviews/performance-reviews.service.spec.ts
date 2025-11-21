import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PerformanceReviewsService } from './performance-reviews.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PdfService } from '../../../common/pdf/pdf.service';
import { CreatePerformanceReviewDto } from './dto/create-performance-review.dto';
import { UpdatePerformanceReviewDto } from './dto/update-performance-review.dto';
import { EmploymentStatus } from '@prisma/client';

describe('PerformanceReviewsService', () => {
  let service: PerformanceReviewsService;
  let prismaService: any;
  let pdfService: any;

  const mockEmployee = {
    id: 'emp-1',
    userId: 'user-1',
    employeeNumber: 'EMP001',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    status: EmploymentStatus.ACTIVE,
    user: {
      id: 'user-1',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
  };

  const mockPerformanceReview = {
    id: 'review-1',
    employeeId: 'emp-1',
    reviewPeriodStart: new Date('2024-01-01'),
    reviewPeriodEnd: new Date('2024-06-30'),
    ratings: { communication: 4, technical: 5, teamwork: 4 },
    strengths: 'Strong technical skills',
    improvements: 'Could improve communication',
    goals: 'Lead a major project',
    overallRating: 4.5,
    reviewedAt: new Date('2024-07-01'),
    reviewerName: 'Jane Manager',
    pdfUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    employee: mockEmployee,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      employee: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      performanceReview: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      template: {
        findFirst: jest.fn(),
      },
    };

    const mockPdfService = {
      generatePdfFromTemplate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceReviewsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PdfService,
          useValue: mockPdfService,
        },
      ],
    }).compile();

    service = module.get<PerformanceReviewsService>(PerformanceReviewsService);
    prismaService = module.get(PrismaService);
    pdfService = module.get(PdfService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createReviewDto: CreatePerformanceReviewDto = {
      employeeId: 'emp-1',
      reviewPeriodStart: '2024-01-01',
      reviewPeriodEnd: '2024-06-30',
      ratings: { communication: 4, technical: 5, teamwork: 4 },
      strengths: 'Strong technical skills',
      improvements: 'Could improve communication',
      goals: 'Lead a major project',
      overallRating: 4.5,
      reviewedAt: '2024-07-01',
      reviewerName: 'Jane Manager',
    };

    it('should create a performance review successfully', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.performanceReview.create.mockResolvedValue(mockPerformanceReview);

      const result = await service.create(createReviewDto);

      expect(result).toBeDefined();
      expect(result.employeeId).toBe(createReviewDto.employeeId);
      expect(prismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { id: createReviewDto.employeeId },
        include: { user: true },
      });
      expect(prismaService.performanceReview.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.create(createReviewDto)).rejects.toThrow(NotFoundException);
      expect(prismaService.performanceReview.create).not.toHaveBeenCalled();
    });

    it('should handle optional fields', async () => {
      const minimalDto: CreatePerformanceReviewDto = {
        employeeId: 'emp-1',
        reviewPeriodStart: '2024-01-01',
        reviewPeriodEnd: '2024-06-30',
        ratings: {},
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.performanceReview.create.mockResolvedValue({
        ...mockPerformanceReview,
        strengths: null,
        improvements: null,
        goals: null,
      });

      await service.create(minimalDto);

      expect(prismaService.performanceReview.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all performance reviews', async () => {
      const mockReviews = [mockPerformanceReview];
      prismaService.performanceReview.findMany.mockResolvedValue(mockReviews);

      const result = await service.findAll();

      expect(result).toEqual(mockReviews);
      expect(prismaService.performanceReview.findMany).toHaveBeenCalled();
    });

    it('should filter by employeeId', async () => {
      prismaService.performanceReview.findMany.mockResolvedValue([mockPerformanceReview]);

      await service.findAll({ employeeId: 'emp-1' });

      expect(prismaService.performanceReview.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return performance review by id', async () => {
      prismaService.performanceReview.findUnique.mockResolvedValue(mockPerformanceReview);

      const result = await service.findOne('review-1');

      expect(result).toEqual(mockPerformanceReview);
      expect(prismaService.performanceReview.findUnique).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when review does not exist', async () => {
      prismaService.performanceReview.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateReviewDto: UpdatePerformanceReviewDto = {
      strengths: 'Updated strengths',
      overallRating: 5,
    };

    it('should update performance review successfully', async () => {
      prismaService.performanceReview.findUnique.mockResolvedValue(mockPerformanceReview);
      prismaService.performanceReview.update.mockResolvedValue({
        ...mockPerformanceReview,
        ...updateReviewDto,
      });

      const result = await service.update('review-1', updateReviewDto);

      expect(result.strengths).toBe(updateReviewDto.strengths);
      expect(result.overallRating).toBe(updateReviewDto.overallRating);
      expect(prismaService.performanceReview.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when review does not exist', async () => {
      prismaService.performanceReview.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateReviewDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.performanceReview.update).not.toHaveBeenCalled();
    });

    it('should handle date updates', async () => {
      const updateWithDates: UpdatePerformanceReviewDto = {
        reviewPeriodStart: '2024-07-01',
        reviewPeriodEnd: '2024-12-31',
        reviewedAt: '2025-01-01',
      };

      prismaService.performanceReview.findUnique.mockResolvedValue(mockPerformanceReview);
      prismaService.performanceReview.update.mockResolvedValue({
        ...mockPerformanceReview,
        ...updateWithDates,
      });

      await service.update('review-1', updateWithDates);

      expect(prismaService.performanceReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewPeriodStart: expect.any(Date),
            reviewPeriodEnd: expect.any(Date),
            reviewedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should handle partial updates', async () => {
      prismaService.performanceReview.findUnique.mockResolvedValue(mockPerformanceReview);
      prismaService.performanceReview.update.mockResolvedValue(mockPerformanceReview);

      await service.update('review-1', { strengths: 'New strengths' });

      expect(prismaService.performanceReview.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete performance review successfully', async () => {
      prismaService.performanceReview.findUnique.mockResolvedValue(mockPerformanceReview);
      prismaService.performanceReview.delete.mockResolvedValue(mockPerformanceReview);

      const result = await service.remove('review-1');

      expect(result).toEqual(mockPerformanceReview);
      expect(prismaService.performanceReview.delete).toHaveBeenCalledWith({
        where: { id: 'review-1' },
      });
    });

    it('should throw NotFoundException when review does not exist', async () => {
      prismaService.performanceReview.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prismaService.performanceReview.delete).not.toHaveBeenCalled();
    });
  });

  describe('generatePdf', () => {
    it('should generate PDF from template', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const mockTemplate = {
        id: 'template-1',
        htmlContent: '<html>Template</html>',
        isDefault: true,
      };

      prismaService.performanceReview.findUnique.mockResolvedValue(mockPerformanceReview);
      prismaService.template.findFirst.mockResolvedValue(mockTemplate);
      pdfService.generatePdfFromTemplate.mockResolvedValue(mockPdfBuffer);

      const result = await service.generatePdf('review-1');

      expect(result).toBe(mockPdfBuffer);
      expect(prismaService.template.findFirst).toHaveBeenCalledWith({
        where: {
          type: 'PERFORMANCE_REVIEW',
          isDefault: true,
        },
      });
      expect(pdfService.generatePdfFromTemplate).toHaveBeenCalled();
    });

    it('should use default template when no template found', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf-content');

      prismaService.performanceReview.findUnique.mockResolvedValue(mockPerformanceReview);
      prismaService.template.findFirst.mockResolvedValue(null);
      pdfService.generatePdfFromTemplate.mockResolvedValue(mockPdfBuffer);

      const result = await service.generatePdf('review-1');

      expect(result).toBe(mockPdfBuffer);
      expect(pdfService.generatePdfFromTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should throw NotFoundException when review does not exist', async () => {
      prismaService.performanceReview.findUnique.mockResolvedValue(null);

      await expect(service.generatePdf('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUpcomingReviews', () => {
    it('should return employees who need reviews', async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const mockEmployees = [
        {
          ...mockEmployee,
          hireDate: sixMonthsAgo,
          performanceReviews: [],
        },
        {
          ...mockEmployee,
          id: 'emp-2',
          hireDate: sixMonthsAgo,
          performanceReviews: [
            {
              createdAt: new Date(),
            },
          ],
        },
      ];

      prismaService.employee.findMany.mockResolvedValue(mockEmployees);

      const result = await service.getUpcomingReviews(30);

      expect(result.length).toBeGreaterThan(0);
      expect(prismaService.employee.findMany).toHaveBeenCalled();
    });

    it('should filter employees who never had a review', async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const mockEmployees = [
        {
          ...mockEmployee,
          hireDate: sixMonthsAgo,
          performanceReviews: [],
        },
      ];

      prismaService.employee.findMany.mockResolvedValue(mockEmployees);

      const result = await service.getUpcomingReviews(30);

      expect(result.length).toBe(1);
    });

    it('should filter employees whose last review was more than 6 months ago', async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      // Set to slightly before sixMonthsAgo to ensure it's "more than 6 months ago"
      const lastReviewDate = new Date(sixMonthsAgo);
      lastReviewDate.setDate(lastReviewDate.getDate() - 1);
      
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const mockEmployees = [
        {
          ...mockEmployee,
          hireDate: oneYearAgo,
          performanceReviews: [
            {
              createdAt: lastReviewDate,
            },
          ],
        },
      ];

      prismaService.employee.findMany.mockResolvedValue(mockEmployees);

      const result = await service.getUpcomingReviews(30);

      expect(result.length).toBe(1);
    });
  });
});

