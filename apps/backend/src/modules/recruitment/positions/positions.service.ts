import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { FilterPositionsDto } from './dto/filter-positions.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { ClosePositionDto } from './dto/close-position.dto';
import { CreatePositionDto } from './dto/create-position.dto';

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
export class OpenPositionsService {
  constructor(private readonly prisma: PrismaService) {}

  private formatPosition(position: any) {
    if (!position) {
      return position;
    }

    return {
      ...position,
      opportunity: position.opportunity
        ? {
            ...position.opportunity,
            value:
              position.opportunity.value !== undefined &&
              position.opportunity.value !== null
                ? Number(position.opportunity.value)
                : null,
          }
        : null,
      candidates: position.candidates?.map((candidateLink: any) => ({
        ...candidateLink,
        candidate: candidateLink.candidate
          ? {
              ...candidateLink.candidate,
              expectedSalary:
                candidateLink.candidate.expectedSalary !== undefined &&
                candidateLink.candidate.expectedSalary !== null
                  ? Number(candidateLink.candidate.expectedSalary)
                  : null,
            }
          : null,
      })),
    };
  }

  async create(createDto: CreatePositionDto) {
    if (createDto.opportunityId) {
      const opportunity = await this.prisma.opportunity.findUnique({
        where: { id: createDto.opportunityId },
        include: {
          openPosition: {
            select: { id: true },
          },
        },
      });

      if (!opportunity) {
        throw new NotFoundException(
          `Opportunity with ID ${createDto.opportunityId} not found`,
        );
      }

      if (opportunity.openPosition) {
        throw new BadRequestException(
          'This opportunity already has a linked job position.',
        );
      }
    }

    const positionData: Prisma.OpenPositionUncheckedCreateInput = {
      title: createDto.title,
      description: createDto.description ?? 'TBD',
      requirements: createDto.requirements,
      status: createDto.status ?? 'Open',
      opportunityId: createDto.opportunityId ?? null,
    };

    const position = await this.prisma.openPosition.create({
      data: positionData,
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
        candidates: {
          take: 5,
          orderBy: { appliedAt: 'desc' },
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                stage: true,
                rating: true,
                expectedSalary: true,
              },
            },
          },
        },
      },
    });

    return this.formatPosition(position);
  }

  private validateSortField(sortBy?: string) {
    if (!sortBy) {
      return;
    }

    const allowed = ['createdAt', 'updatedAt', 'title', 'status'];
    if (!allowed.includes(sortBy)) {
      throw new BadRequestException(`Unsupported sort field: ${sortBy}`);
    }
  }

  private buildWhereClause(
    filters: FilterPositionsDto,
  ): Prisma.OpenPositionWhereInput {
    const where: Prisma.OpenPositionWhereInput = {};

    if (filters.search) {
      const searchTerm = filters.search.trim();
      where.OR = [
        {
          title: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          description: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          requirements: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          opportunity: {
            is: {
              customer: {
                is: {
                  name: {
                    contains: searchTerm,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            },
          },
        },
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.customerId) {
      const relationFilter =
        (where.opportunity as Prisma.OpportunityNullableRelationFilter | undefined) ?? {};
      const currentIs = relationFilter.is ?? {};
      where.opportunity = {
        ...relationFilter,
        is: {
          ...currentIs,
          customerId: filters.customerId,
        },
      };
    }

    if (filters.opportunityId) {
      where.opportunityId = filters.opportunityId;
    }

    if (filters.candidateId) {
      where.candidates = {
        some: {
          candidateId: filters.candidateId,
        },
      };
    }

    if (filters.keywords && filters.keywords.length > 0) {
      where.AND = filters.keywords.map((keyword) => ({
        requirements: {
          contains: keyword,
          mode: Prisma.QueryMode.insensitive,
        },
      }));
    }

    return where;
  }

  private async ensurePositionExists(id: string) {
    const position = await this.prisma.openPosition.findUnique({
      where: { id },
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
    });

    if (!position) {
      throw new NotFoundException(`Open position with ID ${id} not found`);
    }

    return position;
  }

  async findAll(
    filters: FilterPositionsDto,
  ): Promise<PaginatedResult<any>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';
    this.validateSortField(sortBy);

    const where = this.buildWhereClause(filters);

    const [total, positions] = await this.prisma.$transaction([
      this.prisma.openPosition.count({ where }),
      this.prisma.openPosition.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          [sortBy]: sortOrder,
        },
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
          candidates: {
            take: 5,
            orderBy: {
              appliedAt: 'desc',
            },
            include: {
              candidate: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  stage: true,
                  rating: true,
                  expectedSalary: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: positions.map((position) => this.formatPosition(position)),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const position = await this.prisma.openPosition.findUnique({
      where: { id },
      include: {
        opportunity: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
            lead: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        candidates: {
          orderBy: { appliedAt: 'desc' },
          include: {
            candidate: {
              include: {
                positions: true,
              },
            },
          },
        },
      },
    });

    if (!position) {
      throw new NotFoundException(`Open position with ID ${id} not found`);
    }

    return this.formatPosition(position);
  }

  async update(id: string, updateDto: UpdatePositionDto) {
    await this.ensurePositionExists(id);

    const position = await this.prisma.openPosition.update({
      where: { id },
      data: {
        title: updateDto.title,
        description: updateDto.description,
        requirements: updateDto.requirements,
        status: updateDto.status,
      },
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
        candidates: {
          orderBy: { appliedAt: 'desc' },
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                stage: true,
                rating: true,
                expectedSalary: true,
              },
            },
          },
        },
      },
    });

    return this.formatPosition(position);
  }

  async close(id: string, closeDto: ClosePositionDto) {
    await this.ensurePositionExists(id);

    const position = await this.prisma.openPosition.update({
      where: { id },
      data: {
        status: 'Filled',
        filledAt: closeDto.filledAt
          ? new Date(closeDto.filledAt)
          : new Date(),
      },
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
        candidates: {
          orderBy: { appliedAt: 'desc' },
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                stage: true,
                rating: true,
                expectedSalary: true,
              },
            },
          },
        },
      },
    });

    return this.formatPosition(position);
  }

  async getCandidates(id: string) {
    await this.ensurePositionExists(id);

    const candidates = await this.prisma.candidatePosition.findMany({
      where: { positionId: id },
      orderBy: { appliedAt: 'desc' },
      include: {
        candidate: true,
      },
    });

    return candidates.map((link) => ({
      ...link,
      candidate: link.candidate
        ? {
            ...link.candidate,
            expectedSalary:
              link.candidate.expectedSalary !== undefined &&
              link.candidate.expectedSalary !== null
                ? Number(link.candidate.expectedSalary)
                : null,
          }
        : null,
    }));
  }
}


