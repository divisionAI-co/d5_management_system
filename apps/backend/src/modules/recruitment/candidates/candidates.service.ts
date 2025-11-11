import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidateStage, EmploymentStatus, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { FilterCandidatesDto } from './dto/filter-candidates.dto';
import { UpdateCandidateStageDto } from './dto/update-candidate-stage.dto';
import { LinkCandidatePositionDto } from './dto/link-position.dto';
import { ConvertCandidateToEmployeeDto } from './dto/convert-candidate-to-employee.dto';
import { ACTIVITY_SUMMARY_INCLUDE, mapActivitySummary } from '../../activities/activity.mapper';

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
  constructor(private readonly prisma: PrismaService) {}

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

    if (Array.isArray(candidate?.activities)) {
      formatted.activities = candidate.activities.map((activity: any) =>
        mapActivitySummary(activity),
      );
    }

    return formatted;
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
    const where: Prisma.CandidateWhereInput = {};

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
      include: {
        positions: {
          include: {
            position: {
              include: {
                opportunity: true,
              },
            },
          },
        },
        employee: true,
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate with ID ${id} not found`);
    }

    return candidate;
  }

  async create(createDto: CreateCandidateDto) {
    const existing = await this.prisma.candidate.findUnique({
      where: { email: createDto.email },
    });

    if (existing) {
      throw new ConflictException(
        `Candidate with email ${createDto.email} already exists`,
      );
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
      },
      include: {
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
      },
    });

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
        include: {
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
        },
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
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
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
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: ACTIVITY_SUMMARY_INCLUDE,
        },
        employee: true,
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate with ID ${id} not found`);
    }

    return this.formatCandidate(candidate);
  }

  async update(id: string, updateDto: UpdateCandidateDto) {
    await this.ensureCandidateExists(id);

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
        },
        include: {
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
        },
      });

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

    if (updateDto.note) {
      data.notes = candidate.notes
        ? `${candidate.notes}\n\n[Stage Update ${new Date().toISOString()}]\n${updateDto.note}`
        : updateDto.note;
    }

    const updated = await this.prisma.candidate.update({
      where: { id },
      data,
      include: {
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
      },
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
      include: {
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
      },
    });

    return this.formatCandidate(refreshed);
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
        include: {
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
        },
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
}


