import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidateStage, EmploymentStatus, NotificationType, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { TemplatesService } from '../../templates/templates.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { UsersService } from '../../users/users.service';
import { extractMentionIdentifiers } from '../../../common/utils/mention-parser';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { FilterCandidatesDto } from './dto/filter-candidates.dto';
import { UpdateCandidateStageDto } from './dto/update-candidate-stage.dto';
import { LinkCandidatePositionDto } from './dto/link-position.dto';
import { ConvertCandidateToEmployeeDto } from './dto/convert-candidate-to-employee.dto';
import { MarkInactiveDto } from './dto/mark-inactive.dto';
import { SendCandidateEmailDto } from './dto/send-email.dto';
import { ACTIVITY_SUMMARY_INCLUDE, mapActivitySummary } from '../../activities/activity.mapper';

const RECRUITER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
};

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly templatesService: TemplatesService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  private candidateInclude() {
    return {
      positions: {
        include: {
          position: {
            include: {
              opportunity: {
                include: {
                  customer: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      employee: true,
      recruiter: {
        select: RECRUITER_SELECT,
      },
    };
  }

  private async ensureRecruiterExists(recruiterId: string) {
    const recruiter = await this.prisma.user.findUnique({
      where: { id: recruiterId },
      select: { id: true },
    });

    if (!recruiter) {
      throw new BadRequestException('Recruiter not found.');
    }

    return recruiter.id;
  }

  private formatCandidate(candidate: any) {
    if (!candidate) {
      return candidate;
    }

    const formatted = {
      ...candidate,
      expectedSalary:
        candidate?.expectedSalary !== undefined && candidate?.expectedSalary !== null
          ? Number(candidate.expectedSalary)
          : null,
      positions: candidate?.positions?.map((cp: any) => ({
        ...cp,
        position: cp.position
          ? {
              ...cp.position,
              opportunity: cp.position.opportunity
                ? {
                    ...cp.position.opportunity,
                    value:
                      cp.position.opportunity.value !== undefined &&
                      cp.position.opportunity.value !== null
                        ? Number(cp.position.opportunity.value)
                        : null,
                  }
                : null,
            }
          : null,
      })),
    };

    formatted.driveFolderId = candidate.driveFolderId ?? null;
    formatted.driveFolderUrl = candidate.driveFolderId
      ? `https://drive.google.com/drive/folders/${candidate.driveFolderId}`
      : null;

    formatted.recruiter = candidate.recruiter
      ? {
          id: candidate.recruiter.id,
          firstName: candidate.recruiter.firstName,
          lastName: candidate.recruiter.lastName,
          email: candidate.recruiter.email,
          avatar: candidate.recruiter.avatar ?? null,
        }
      : null;

    if (Array.isArray(candidate?.activities)) {
      formatted.activities = candidate.activities.map((activity: any) =>
        mapActivitySummary(activity),
      );
    }

    return formatted;
  }

  private extractDriveFolderId(input?: string | null): string | undefined {
    if (!input) {
      return undefined;
    }

    const trimmed = input.trim();

    if (!trimmed) {
      return undefined;
    }

    const idPattern = /[-\w]{10,}/;

    // If it does not look like a URL, assume it's already an ID.
    if (!trimmed.includes('/')) {
      const maybeId = trimmed.match(idPattern)?.[0];
      return maybeId ?? undefined;
    }

    try {
      const url = new URL(trimmed);

      // Only extract folder IDs, not file IDs
      // Check for folder pattern first: /drive/folders/ID or /folders/ID
      const folderMatch = url.pathname.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/) || 
                         url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (folderMatch?.[1]) {
        return folderMatch[1];
      }

      // If it's a file URL (/file/d/ID), reject it - this is not a folder
      const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch?.[1]) {
        // This is a file, not a folder - return undefined
        return undefined;
      }

      const idFromQuery = url.searchParams.get('id');
      if (idFromQuery) {
        return idFromQuery;
      }
    } catch {
      // Not a valid URL; fall back to regex below.
    }

    const fallbackMatch = trimmed.match(idPattern);
    return fallbackMatch?.[0];
  }

  private validateSortField(sortBy?: string) {
    if (!sortBy) {
      return;
    }

    const allowed = ['createdAt', 'updatedAt', 'stage', 'rating', 'firstName'];
    if (!allowed.includes(sortBy)) {
      throw new BadRequestException(`Unsupported sort field: ${sortBy}`);
    }
  }

  private buildWhereClause(
    filters: FilterCandidatesDto,
  ): Prisma.CandidateWhereInput {
    const where: Prisma.CandidateWhereInput = {
      // Filter out deleted candidates by default
      deletedAt: null,
    };

    // Only filter by isActive if explicitly provided
    // If not provided, show all candidates (both active and inactive)
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      const searchTerm = filters.search.trim();
      where.OR = [
        {
          firstName: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          lastName: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          email: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          city: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          country: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ];
    }

    if (filters.stage) {
      where.stage = filters.stage;
    }

    if (filters.recruiterId) {
      where.recruiterId = filters.recruiterId;
    }

    const positionFilters: Prisma.CandidatePositionListRelationFilter = {};

    if (filters.positionId) {
      positionFilters.some = {
        ...(positionFilters.some ?? {}),
        positionId: filters.positionId,
      };
    }

    if (filters.hasOpenPosition !== undefined) {
      if (filters.hasOpenPosition) {
        positionFilters.some = {
          ...(positionFilters.some ?? {}),
          position: {
            is: {
              status: 'Open',
            },
          },
        };
      } else {
        positionFilters.none = {
          position: {
            is: {
              status: 'Open',
            },
          },
        };
      }
    }

    if (Object.keys(positionFilters).length > 0) {
      where.positions = positionFilters;
    }

    if (filters.skills && filters.skills.length > 0) {
      where.skills = {
        hasSome: filters.skills,
      };
    }

    return where;
  }

  private async ensureCandidateExists(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: this.candidateInclude(),
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate with ID ${id} not found`);
    }

    return candidate;
  }

  async create(createDto: CreateCandidateDto, userId: string) {
    const existing = await this.prisma.candidate.findUnique({
      where: { email: createDto.email },
    });

    if (existing) {
      throw new ConflictException(
        `Candidate with email ${createDto.email} already exists`,
      );
    }

    const inputValue = createDto.driveFolderId ?? createDto.driveFolderUrl;
    const driveFolderId = this.extractDriveFolderId(inputValue);

    // If a value was provided but couldn't be extracted (e.g., file URL in folder field),
    // throw an error for create (since we need valid data), but allow null for updates
    if (inputValue && !driveFolderId) {
      throw new BadRequestException(
        'Unable to extract Google Drive folder ID from the provided value. Please provide a valid folder URL or ID, not a file URL.',
      );
    }

    let recruiterId: string | undefined;
    if (createDto.recruiterId) {
      recruiterId = await this.ensureRecruiterExists(createDto.recruiterId);
    }

    const candidate = await this.prisma.candidate.create({
      data: {
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        email: createDto.email.toLowerCase(),
        phone: createDto.phone,
        currentTitle: createDto.currentTitle,
        yearsOfExperience: createDto.yearsOfExperience,
        skills: createDto.skills ?? [],
        resume: createDto.resume,
        linkedinUrl: createDto.linkedinUrl,
        githubUrl: createDto.githubUrl,
        portfolioUrl: createDto.portfolioUrl,
        stage: createDto.stage ?? CandidateStage.VALIDATION,
        rating: createDto.rating,
        notes: createDto.notes,
        isActive: createDto.isActive ?? true,
        city: createDto.city,
        country: createDto.country,
        availableFrom: createDto.availableFrom
          ? new Date(createDto.availableFrom)
          : undefined,
        expectedSalary:
          createDto.expectedSalary !== undefined &&
          createDto.expectedSalary !== null
            ? new Prisma.Decimal(createDto.expectedSalary)
            : undefined,
        salaryCurrency: createDto.salaryCurrency,
        driveFolderId,
        recruiterId,
      },
      include: this.candidateInclude(),
    });

    // Process @mentions in notes and create notifications
    if (createDto.notes) {
      this.processMentions(candidate.id, createDto.notes, userId).catch((error) => {
        console.error(`[Mentions] Failed to process mentions for candidate ${candidate.id}:`, error);
      });
    }

    return this.formatCandidate(candidate);
  }

  async findAll(filters: FilterCandidatesDto): Promise<PaginatedResult<any>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';
    this.validateSortField(sortBy);

    const where = this.buildWhereClause(filters);

    const [total, candidates] = await this.prisma.$transaction([
      this.prisma.candidate.count({ where }),
      this.prisma.candidate.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: this.candidateInclude(),
      }),
    ]);

    return {
      data: candidates.map((candidate) => this.formatCandidate(candidate)),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        ...this.candidateInclude(),
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: ACTIVITY_SUMMARY_INCLUDE,
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate with ID ${id} not found`);
    }

    return this.formatCandidate(candidate);
  }

  async update(id: string, updateDto: UpdateCandidateDto, userId: string) {
    await this.ensureCandidateExists(id);

    let driveFolderIdUpdate: string | null | undefined = undefined;
    if (
      updateDto.driveFolderId !== undefined ||
      updateDto.driveFolderUrl !== undefined
    ) {
      const inputValue = updateDto.driveFolderId ?? updateDto.driveFolderUrl;
      
      // If the input is an empty string or null, explicitly clear the field
      if (!inputValue || (typeof inputValue === 'string' && inputValue.trim().length === 0)) {
        driveFolderIdUpdate = null;
      } else {
        const resolved = this.extractDriveFolderId(inputValue);

        // If a value was provided but couldn't be extracted (e.g., file URL in folder field),
        // silently ignore it rather than throwing an error - this allows users to clear invalid values
        if (!resolved) {
          // Invalid value provided (e.g., file URL instead of folder URL) - set to null to clear it
          driveFolderIdUpdate = null;
        } else {
          // Valid folder ID extracted
          driveFolderIdUpdate = resolved;
        }
      }
    }

    let recruiterIdUpdate: string | null | undefined = undefined;
    if (updateDto.recruiterId !== undefined) {
      recruiterIdUpdate = updateDto.recruiterId
        ? await this.ensureRecruiterExists(updateDto.recruiterId)
        : null;
    }

    try {
      const candidate = await this.prisma.candidate.update({
        where: { id },
        data: {
          firstName: updateDto.firstName,
          lastName: updateDto.lastName,
          email: updateDto.email?.toLowerCase(),
          phone: updateDto.phone,
          currentTitle: updateDto.currentTitle,
          yearsOfExperience: updateDto.yearsOfExperience,
          skills:
            updateDto.skills !== undefined ? updateDto.skills : undefined,
          resume: updateDto.resume,
          linkedinUrl: updateDto.linkedinUrl,
          githubUrl: updateDto.githubUrl,
          portfolioUrl: updateDto.portfolioUrl,
          stage: updateDto.stage,
          rating: updateDto.rating,
          notes: updateDto.notes,
          isActive:
            updateDto.isActive !== undefined ? updateDto.isActive : undefined,
          city: updateDto.city,
          country: updateDto.country,
          availableFrom: updateDto.availableFrom
            ? new Date(updateDto.availableFrom)
            : updateDto.availableFrom === null
            ? null
            : undefined,
          expectedSalary:
            updateDto.expectedSalary !== undefined
              ? updateDto.expectedSalary === null
                ? null
                : new Prisma.Decimal(updateDto.expectedSalary)
              : undefined,
          salaryCurrency: updateDto.salaryCurrency,
          driveFolderId: driveFolderIdUpdate,
          recruiterId:
            recruiterIdUpdate !== undefined ? recruiterIdUpdate : undefined,
        },
        include: this.candidateInclude(),
      });

      // Process @mentions if notes were updated
      if (updateDto.notes !== undefined) {
        this.processMentions(id, updateDto.notes, userId).catch((error) => {
          console.error(`[Mentions] Failed to process mentions for candidate ${id}:`, error);
        });
      }

      return this.formatCandidate(candidate);
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        throw new ConflictException(
          `Candidate with email ${updateDto.email} already exists`,
        );
      }
      throw error;
    }
  }

  async updateStage(id: string, updateDto: UpdateCandidateStageDto) {
    const candidate = await this.ensureCandidateExists(id);

    const data: Prisma.CandidateUpdateInput = {
      stage: updateDto.stage,
    };

    // When a candidate is rejected, mark them as inactive but keep position links
    if (updateDto.stage === CandidateStage.REJECTED) {
      data.isActive = false;
    }

    if (updateDto.note) {
      data.notes = candidate.notes
        ? `${candidate.notes}\n\n[Stage Update ${new Date().toISOString()}]\n${updateDto.note}`
        : updateDto.note;
    }

    const updated = await this.prisma.candidate.update({
      where: { id },
      data,
      include: this.candidateInclude(),
    });

    return this.formatCandidate(updated);
  }

  async linkToPosition(candidateId: string, linkDto: LinkCandidatePositionDto) {
    const [candidate, position] = await Promise.all([
      this.ensureCandidateExists(candidateId),
      this.prisma.openPosition.findUnique({
        where: { id: linkDto.positionId },
        include: {
          opportunity: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!position) {
      throw new NotFoundException(
        `Open position with ID ${linkDto.positionId} not found`,
      );
    }

    try {
      await this.prisma.candidatePosition.upsert({
        where: {
          candidateId_positionId: {
            candidateId: candidate.id,
            positionId: position.id,
          },
        },
        update: {
          appliedAt: linkDto.appliedAt
            ? new Date(linkDto.appliedAt)
            : undefined,
          status: linkDto.status,
          notes: linkDto.notes,
        },
        create: {
          candidateId: candidate.id,
          positionId: position.id,
          appliedAt: linkDto.appliedAt
            ? new Date(linkDto.appliedAt)
            : undefined,
          status: linkDto.status ?? 'Under Review',
          notes: linkDto.notes,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Candidate is already linked to the specified position',
        );
      }
      throw error;
    }

    const refreshed = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: this.candidateInclude(),
    });

    return this.formatCandidate(refreshed);
  }

  async unlinkPosition(candidateId: string, positionId: string) {
    await this.ensureCandidateExists(candidateId);

    const existingLink = await this.prisma.candidatePosition.findUnique({
      where: {
        candidateId_positionId: {
          candidateId,
          positionId,
        },
      },
    });

    if (!existingLink) {
      throw new NotFoundException(
        `Candidate ${candidateId} is not linked to position ${positionId}`,
      );
    }

    await this.prisma.candidatePosition.delete({
      where: {
        candidateId_positionId: {
          candidateId,
          positionId,
        },
      },
    });

    const updated = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: this.candidateInclude(),
    });

    if (!updated) {
      throw new NotFoundException(`Candidate with ID ${candidateId} not found`);
    }

    return this.formatCandidate(updated);
  }

  private generateSecurePassword() {
    return randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
  }

  async convertToEmployee(
    candidateId: string,
    convertDto: ConvertCandidateToEmployeeDto,
  ) {
    const candidate = await this.ensureCandidateExists(candidateId);

    if (candidate.employee) {
      throw new ConflictException('Candidate is already associated with an employee record');
    }

    let temporaryPassword: string | undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      let resolvedUserId = convertDto.userId;
      let userRecord:
        | {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            role: UserRole;
          }
        | null = null;

      if (resolvedUserId) {
        const existingUser = await tx.user.findUnique({
          where: { id: resolvedUserId },
          include: { employee: true },
        });

        if (!existingUser) {
          throw new NotFoundException(`User with ID ${resolvedUserId} not found`);
        }

        if (existingUser.employee) {
          throw new ConflictException('The selected user already has an employee record');
        }

        userRecord = existingUser;
      } else {
        const existingUserByEmail = await tx.user.findUnique({
          where: { email: candidate.email.toLowerCase() },
          include: { employee: true },
        });

        if (existingUserByEmail) {
          if (existingUserByEmail.employee) {
            throw new ConflictException(
              'A user with the candidate email already has an employee record. Please select a different user.',
            );
          }

          resolvedUserId = existingUserByEmail.id;
          userRecord = existingUserByEmail;
        } else {
          if (convertDto.autoGeneratePassword === false && !convertDto.user?.password) {
            throw new BadRequestException(
              'Password is required when autoGeneratePassword is set to false.',
            );
          }

          const password =
            (!convertDto.autoGeneratePassword && convertDto.user?.password) ||
            this.generateSecurePassword();

          temporaryPassword = password;

          const hashedPassword = await bcrypt.hash(password, 10);

          const newUser = await tx.user.create({
            data: {
              email: candidate.email.toLowerCase(),
              password: hashedPassword,
              firstName: candidate.firstName,
              lastName: candidate.lastName,
              role: convertDto.user?.role ?? UserRole.EMPLOYEE,
              phone: convertDto.user?.phone ?? candidate.phone ?? undefined,
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          });

          resolvedUserId = newUser.id;
          userRecord = newUser;
        }
      }

      if (!resolvedUserId || !userRecord) {
        throw new BadRequestException('Unable to resolve user for the new employee');
      }

      const employee = await tx.employee.create({
        data: {
          userId: resolvedUserId,
          candidateId: candidate.id,
          employeeNumber: convertDto.employeeNumber,
          department: convertDto.department,
          jobTitle: convertDto.jobTitle ?? candidate.currentTitle ?? 'Employee',
          status: convertDto.status ?? EmploymentStatus.ACTIVE,
          contractType: convertDto.contractType,
          hireDate: new Date(convertDto.hireDate),
          terminationDate: convertDto.terminationDate
            ? new Date(convertDto.terminationDate)
            : null,
          salary: new Prisma.Decimal(convertDto.salary),
          salaryCurrency: convertDto.salaryCurrency ?? candidate.salaryCurrency ?? 'USD',
          managerId: convertDto.managerId,
          emergencyContactName: convertDto.emergencyContactName,
          emergencyContactPhone: convertDto.emergencyContactPhone,
          emergencyContactRelation: convertDto.emergencyContactRelation,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });

      const updatedCandidate = await tx.candidate.update({
        where: { id: candidate.id },
        data: {
          stage: CandidateStage.HIRED,
        },
        include: this.candidateInclude(),
      });

      return {
        employee,
        candidate: updatedCandidate,
      };
    });

    return {
      employee: result.employee,
      candidate: this.formatCandidate(result.candidate),
      temporaryPassword,
    };
  }

  async getPositions(candidateId: string) {
    await this.ensureCandidateExists(candidateId);

    const positions = await this.prisma.candidatePosition.findMany({
      where: { candidateId },
      include: {
        position: {
          include: {
            opportunity: {
              include: {
                customer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    });

    return positions.map((link) => ({
      ...link,
      position: link.position
        ? {
            ...link.position,
            opportunity: link.position.opportunity
              ? {
                  ...link.position.opportunity,
                  value:
                    link.position.opportunity.value !== undefined &&
                    link.position.opportunity.value !== null
                      ? Number(link.position.opportunity.value)
                      : null,
                }
              : null,
          }
        : null,
    }));
  }

  async archive(id: string) {
    const candidate = await this.ensureCandidateExists(id);

    if (candidate.deletedAt) {
      throw new BadRequestException('Candidate is already archived.');
    }

    const updated = await this.prisma.candidate.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
      include: this.candidateInclude(),
    });

    return this.formatCandidate(updated);
  }

  async restore(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: this.candidateInclude(),
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate with ID ${id} not found`);
    }

    if (!candidate.deletedAt) {
      throw new BadRequestException('Candidate is not archived.');
    }

    const updated = await this.prisma.candidate.update({
      where: { id },
      data: {
        deletedAt: null,
      },
      include: this.candidateInclude(),
    });

    return this.formatCandidate(updated);
  }

  async markInactive(id: string, dto: MarkInactiveDto) {
    const candidate = await this.ensureCandidateExists(id);

    const updateData: Prisma.CandidateUpdateInput = {
      isActive: false,
    };

    if (dto.reason) {
      updateData.notes = candidate.notes
        ? `${candidate.notes}\n\n[Marked Inactive ${new Date().toISOString()}]\n${dto.reason}`
        : dto.reason;
    }

    // Mark as inactive but keep position links
    const updated = await this.prisma.candidate.update({
          where: { id },
          data: updateData,
        include: this.candidateInclude(),
    });

    if (!updated) {
      throw new NotFoundException(`Candidate with ID ${id} not found`);
    }

    // Send email if requested
    if (dto.sendEmail) {
      const recipientEmail = dto.emailTo || updated.email;
      if (!recipientEmail) {
        throw new BadRequestException(
          'Cannot send email: candidate has no email address and no recipient email was provided.',
        );
      }

      let emailSubject: string;
      let emailBody: string;

      if (dto.templateId) {
        // Use template
        try {
          const templateData = {
            candidate: {
              firstName: updated.firstName,
              lastName: updated.lastName,
              email: updated.email,
              fullName: `${updated.firstName} ${updated.lastName}`,
            },
            reason: dto.reason || 'No reason provided',
          };

          const rendered = await this.templatesService.render(dto.templateId, templateData);
          emailBody = rendered.html;
          emailSubject = `Update on Your Application - ${updated.firstName} ${updated.lastName}`;
        } catch (error: any) {
          throw new BadRequestException(
            `Failed to render email template: ${error?.message ?? 'Unknown error'}`,
          );
        }
      } else {
        // Use custom email
        if (!dto.emailSubject || !dto.emailBody) {
          throw new BadRequestException(
            'Email subject and body are required when not using a template.',
          );
        }
        emailSubject = dto.emailSubject;
        emailBody = dto.emailBody;
      }

      try {
        await this.emailService.sendEmail({
          to: recipientEmail,
          subject: emailSubject,
          html: emailBody,
        });
      } catch (error: any) {
        // Log error but don't fail the operation
        console.error('Failed to send email to candidate:', error);
        // Still return the updated candidate even if email fails
      }
    }

    return this.formatCandidate(updated);
  }

  async delete(id: string) {
    const candidate = await this.ensureCandidateExists(id);

    // Check if candidate is linked to an employee
    if (candidate.employee) {
      throw new BadRequestException(
        'Cannot delete candidate that is linked to an employee. Archive it instead.',
      );
    }

    // Hard delete the candidate
    await this.prisma.candidate.delete({
      where: { id },
    });

    return { success: true, message: 'Candidate deleted successfully.' };
  }

  async sendEmail(id: string, dto: SendCandidateEmailDto) {
    const candidateRaw = await this.prisma.candidate.findUnique({
      where: { id },
      include: this.candidateInclude(),
    });

    if (!candidateRaw) {
      throw new NotFoundException(`Candidate with ID ${id} not found`);
    }

    const candidate = this.formatCandidate(candidateRaw);

    let htmlContent = dto.htmlContent;
    let textContent = dto.textContent;

    // If template is provided, render it with candidate data
    if (dto.templateId) {
      const templateData = {
        candidate: {
          id: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          fullName: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email,
          phone: candidate.phone,
          currentTitle: candidate.currentTitle,
          yearsOfExperience: candidate.yearsOfExperience,
          skills: candidate.skills,
          stage: candidate.stage,
          rating: candidate.rating,
          notes: candidate.notes,
          city: candidate.city,
          country: candidate.country,
          availableFrom: candidate.availableFrom,
          expectedSalary: candidate.expectedSalary ? Number(candidate.expectedSalary) : null,
          salaryCurrency: candidate.salaryCurrency,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt,
        },
        recruiter: candidate.recruiter
          ? {
              firstName: candidate.recruiter.firstName,
              lastName: candidate.recruiter.lastName,
              email: candidate.recruiter.email,
            }
          : null,
        positions: candidate.positions?.map((cp: any) => ({
          title: cp.position?.title,
          description: cp.position?.description,
          requirements: cp.position?.requirements,
          status: cp.status,
          appliedAt: cp.appliedAt,
          customer: cp.position?.opportunity?.customer
            ? {
                name: cp.position.opportunity.customer.name,
                email: cp.position.opportunity.customer.email || null,
              }
            : null,
        })),
      };

      const rendered = await this.templatesService.render(dto.templateId, templateData);
      htmlContent = rendered.html;
      textContent = rendered.text;
    } else if (!htmlContent) {
      throw new BadRequestException(
        'Either templateId or htmlContent must be provided',
      );
    }

    // Parse CC and BCC
    const cc = dto.cc ? dto.cc.split(',').map((email) => email.trim()) : undefined;
    const bcc = dto.bcc ? dto.bcc.split(',').map((email) => email.trim()) : undefined;

    const success = await this.emailService.sendEmail({
      to: dto.to,
      subject: dto.subject,
      html: htmlContent,
      text: textContent,
      cc,
      bcc,
    });

    if (!success) {
      throw new BadRequestException('Failed to send email');
    }

    return {
      success: true,
      message: 'Email sent successfully',
      to: dto.to,
      subject: dto.subject,
    };
  }

  async listRecruiters() {
    return this.prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.RECRUITER, UserRole.HR, UserRole.ADMIN],
        },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    });
  }

  /**
   * Process @mentions in candidate notes and create notifications
   */
  private async processMentions(
    candidateId: string,
    notes: string | null | undefined,
    createdById: string,
  ) {
    try {
      if (!notes) {
        return;
      }

      // Extract mention identifiers
      const identifiers = extractMentionIdentifiers(notes);
      if (identifiers.length === 0) {
        return;
      }

      console.log(`[Mentions] Processing mentions for candidate ${candidateId}:`, {
        identifiers,
        textPreview: notes.substring(0, 100),
      });

      // Find users by mentions
      const mentionedUserIds = await this.usersService.findUsersByMentions(identifiers);
      
      console.log(`[Mentions] Found ${mentionedUserIds.length} users for mentions:`, mentionedUserIds);
      
      // Remove the creator from mentioned users (they don't need to be notified about their own mentions)
      const userIdsToNotify = mentionedUserIds.filter((id) => id !== createdById);
      
      if (userIdsToNotify.length === 0) {
        console.log(`[Mentions] No users to notify (all mentions were by creator or no matches found)`);
        return;
      }

      // Get creator info for notification message
      const creator = await this.prisma.user.findUnique({
        where: { id: createdById },
        select: { firstName: true, lastName: true, email: true },
      });

      const creatorName = creator
        ? `${creator.firstName} ${creator.lastName}`.trim() || creator.email
        : 'Someone';

      // Get candidate info for notification message
      const candidate = await this.prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { firstName: true, lastName: true },
      });

      const candidateName = candidate
        ? `${candidate.firstName} ${candidate.lastName}`.trim()
        : 'a candidate';

      // Create notifications for mentioned users
      const notifications = await this.notificationsService.createNotificationsForUsers(
        userIdsToNotify,
        'MENTIONED_IN_ACTIVITY' as any,
        `You were mentioned in a candidate`,
        `${creatorName} mentioned you in candidate "${candidateName}"`,
        'candidate',
        candidateId,
      );

      console.log(`[Mentions] Created ${notifications.length} notifications for candidate ${candidateId}`);
    } catch (error) {
      // Log error but don't fail the candidate creation/update
      console.error(`[Mentions] Error processing mentions for candidate ${candidateId}:`, error);
    }
  }
}


