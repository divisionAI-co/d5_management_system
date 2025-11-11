import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PdfService } from '../../../common/pdf/pdf.service';
import { CreatePerformanceReviewDto } from './dto/create-performance-review.dto';
import { UpdatePerformanceReviewDto } from './dto/update-performance-review.dto';

@Injectable()
export class PerformanceReviewsService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {}

  async create(createReviewDto: CreatePerformanceReviewDto) {
    // Verify employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: createReviewDto.employeeId },
      include: {
        user: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${createReviewDto.employeeId} not found`);
    }

    return this.prisma.performanceReview.create({
      data: {
        employeeId: createReviewDto.employeeId,
        reviewPeriodStart: new Date(createReviewDto.reviewPeriodStart),
        reviewPeriodEnd: new Date(createReviewDto.reviewPeriodEnd),
        ratings: createReviewDto.ratings as Prisma.InputJsonValue,
        strengths: createReviewDto.strengths,
        improvements: createReviewDto.improvements,
        goals: createReviewDto.goals,
        overallRating: createReviewDto.overallRating,
        reviewedAt: createReviewDto.reviewedAt ? new Date(createReviewDto.reviewedAt) : null,
        reviewerName: createReviewDto.reviewerName,
        pdfUrl: createReviewDto.pdfUrl,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll(filters?: { employeeId?: string; employeeIds?: string[] }) {
    const where: any = {};

    if (filters?.employeeIds && filters.employeeIds.length > 0) {
      where.employeeId = {
        in: filters.employeeIds,
      };
    } else if (filters?.employeeId) {
      where.employeeId = filters.employeeId;
    }

    return this.prisma.performanceReview.findMany({
      where,
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException(`Performance review with ID ${id} not found`);
    }

    return review;
  }

  async update(id: string, updateReviewDto: UpdatePerformanceReviewDto) {
    await this.findOne(id);

    const data: any = {};

    if (updateReviewDto.reviewPeriodStart) {
      data.reviewPeriodStart = new Date(updateReviewDto.reviewPeriodStart);
    }

    if (updateReviewDto.reviewPeriodEnd) {
      data.reviewPeriodEnd = new Date(updateReviewDto.reviewPeriodEnd);
    }

    if (updateReviewDto.ratings !== undefined) {
      data.ratings = updateReviewDto.ratings as Prisma.InputJsonValue;
    }

    if (updateReviewDto.strengths !== undefined) {
      data.strengths = updateReviewDto.strengths;
    }

    if (updateReviewDto.improvements !== undefined) {
      data.improvements = updateReviewDto.improvements;
    }

    if (updateReviewDto.goals !== undefined) {
      data.goals = updateReviewDto.goals;
    }

    if (updateReviewDto.overallRating !== undefined) {
      data.overallRating = updateReviewDto.overallRating;
    }

    if (updateReviewDto.reviewedAt) {
      data.reviewedAt = new Date(updateReviewDto.reviewedAt);
    }

    if (updateReviewDto.reviewerName !== undefined) {
      data.reviewerName = updateReviewDto.reviewerName;
    }

    if (updateReviewDto.pdfUrl !== undefined) {
      data.pdfUrl = updateReviewDto.pdfUrl;
    }

    return this.prisma.performanceReview.update({
      where: { id },
      data,
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.performanceReview.delete({
      where: { id },
    });
  }

  async generatePdf(id: string): Promise<Buffer> {
    const review = await this.findOne(id);

    // Get default template
    const defaultTemplate = await this.prisma.template.findFirst({
      where: {
        type: 'PERFORMANCE_REVIEW',
        isDefault: true,
      },
    });

    const template = defaultTemplate?.htmlContent || this.getDefaultTemplate();

    // Prepare data for template
    const data = {
      employeeName: `${review.employee.user.firstName} ${review.employee.user.lastName}`,
      employeeEmail: review.employee.user.email,
      jobTitle: review.employee.jobTitle,
      department: review.employee.department || 'N/A',
      reviewerName: review.reviewerName || 'N/A',
      reviewDate: review.reviewedAt ? review.reviewedAt.toLocaleDateString() : 'N/A',
      periodStart: review.reviewPeriodStart.toLocaleDateString(),
      periodEnd: review.reviewPeriodEnd.toLocaleDateString(),
      overallRating: review.overallRating?.toString() || 'N/A',
      strengths: review.strengths || 'N/A',
      improvements: review.improvements || 'N/A',
      goals: review.goals || 'N/A',
      ratings: JSON.stringify(review.ratings, null, 2),
    };

    return this.pdfService.generatePdfFromTemplate(template, data);
  }

  private getDefaultTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Performance Review</h1>
          <p>{{reviewDate}}</p>
        </div>
        <table>
          <tr>
            <td class="label">Employee:</td>
            <td>{{employeeName}}</td>
          </tr>
          <tr>
            <td class="label">Job Title:</td>
            <td>{{jobTitle}}</td>
          </tr>
          <tr>
            <td class="label">Department:</td>
            <td>{{department}}</td>
          </tr>
          <tr>
            <td class="label">Review Period:</td>
            <td>{{periodStart}} - {{periodEnd}}</td>
          </tr>
          <tr>
            <td class="label">Reviewer:</td>
            <td>{{reviewerName}}</td>
          </tr>
          <tr>
            <td class="label">Overall Rating:</td>
            <td>{{overallRating}}</td>
          </tr>
        </table>
        <div class="section">
          <h3>Strengths</h3>
          <p>{{strengths}}</p>
        </div>
        <div class="section">
          <h3>Areas for Improvement</h3>
          <p>{{improvements}}</p>
        </div>
        <div class="section">
          <h3>Goals</h3>
          <p>{{goals}}</p>
        </div>
      </body>
      </html>
    `;
  }

  async getUpcomingReviews(daysAhead: number = 30) {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    const employees = await this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        hireDate: {
          lte: sixMonthsAgo,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        performanceReviews: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    // Filter employees who need a review
    return employees.filter((employee) => {
      if (employee.performanceReviews.length === 0) {
        return true; // Never had a review
      }

      const lastReview = employee.performanceReviews[0];
      return lastReview.createdAt < sixMonthsAgo;
    });
  }
}
