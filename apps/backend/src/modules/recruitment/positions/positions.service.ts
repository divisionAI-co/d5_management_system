import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { QueryBuilder } from '../../../common/utils/query-builder.util';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { FilterPositionsDto } from './dto/filter-positions.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { ClosePositionDto } from './dto/close-position.dto';
import { CreatePositionDto } from './dto/create-position.dto';

@Injectable()
export class OpenPositionsService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

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
      });

      if (!opportunity) {
        throw new NotFoundException(
          ErrorMessages.NOT_FOUND('Opportunity', createDto.opportunityId),
        );
      }
    }

    const positionData: Prisma.OpenPositionUncheckedCreateInput = {
      title: createDto.title,
      description: createDto.description ?? 'TBD',
      requirements: createDto.requirements,
      status: createDto.status ?? 'Open',
      ...(createDto.recruitmentStatus !== undefined && { recruitmentStatus: createDto.recruitmentStatus }),
      ...(createDto.opportunityId !== undefined && { opportunityId: createDto.opportunityId || null }),
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
            lead: {
              select: {
                id: true,
                title: true,
                leadType: true,
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
    try {
      QueryBuilder.validateSortField(sortBy, ['createdAt', 'updatedAt', 'title', 'status']);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : `Unsupported sort field: ${sortBy}`);
    }
  }

  private buildWhereClause(
    filters: FilterPositionsDto,
  ): Prisma.OpenPositionWhereInput {
    // Exclude complex filters from QueryBuilder
    const { search, customerId, candidateId, keywords, ...baseFilters } = filters;
    
    const baseWhere = QueryBuilder.buildWhereClause<Prisma.OpenPositionWhereInput>(
      baseFilters,
      {
        searchFields: ['title', 'description', 'requirements'],
      },
    );

    // Filter by archived status - default to non-archived if not specified
    if (filters.isArchived !== undefined) {
      baseWhere.isArchived = filters.isArchived;
    } else {
      baseWhere.isArchived = false;
    }

    // Handle complex search across title, description, requirements, and customer name
    if (search) {
      const searchTerm = search.trim();
      baseWhere.OR = [
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

    // Handle customerId filter (complex relation filtering)
    if (customerId) {
      const relationFilter =
        (baseWhere.opportunity as Prisma.OpportunityNullableRelationFilter | undefined) ?? {};
      const currentIs = relationFilter.is ?? {};
      baseWhere.opportunity = {
        ...relationFilter,
        is: {
          ...currentIs,
          customerId: customerId,
        },
      };
    }

    // Handle candidateId filter (relation filtering)
    if (candidateId) {
      baseWhere.candidates = {
        some: {
          candidateId: candidateId,
        },
      };
    }

    // Handle keywords array filter (AND condition)
    if (keywords && keywords.length > 0) {
      const existingAnd = Array.isArray(baseWhere.AND) ? baseWhere.AND : baseWhere.AND ? [baseWhere.AND] : [];
      baseWhere.AND = [
        ...existingAnd,
        ...keywords.map((keyword) => ({
          requirements: {
            contains: keyword,
            mode: Prisma.QueryMode.insensitive,
          },
        })),
      ];
    }

    return baseWhere;
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
            lead: {
              select: {
                id: true,
                title: true,
                leadType: true,
              },
            },
          },
        },
      },
    });

    if (!position) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Open position', id));
    }

    return position;
  }

  /**
   * Public method for website showcase - returns only open, non-archived positions
   * without sensitive candidate information
   */
  async findAllPublic(filters: FilterPositionsDto) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;

    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';
    this.validateSortField(sortBy);

    // Build where clause but force public filters
    const where = this.buildWhereClause({
      ...filters,
      // Force public filters: only open, non-archived positions
      status: 'Open',
      isArchived: false,
    });

    const result = await this.paginate(
      this.prisma.openPosition,
      where,
      {
        page,
        pageSize,
        orderBy: {
          [sortBy]: sortOrder,
        },
        // Exclude opportunity and candidates for public endpoint
      }
    );

    // Format and sanitize for public display
    return {
      ...result,
      data: result.data.map((position) => this.formatPublicPosition(position)),
    };
  }

  /**
   * Public method for website showcase - returns a single position
   * without sensitive candidate information
   */
  async findOnePublic(id: string) {
    const position = await this.prisma.openPosition.findUnique({
      where: { 
        id,
        status: 'Open',
        isArchived: false,
      },
      // Exclude opportunity and candidates for public endpoint
    });

    if (!position) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Open position', id));
    }

    return this.formatPublicPosition(position);
  }

  /**
   * Format position for public display (no sensitive data, no opportunity info)
   */
  private formatPublicPosition(position: any) {
    if (!position) {
      return position;
    }

    return {
      id: position.id,
      title: position.title,
      description: position.description,
      requirements: position.requirements,
      status: position.status,
      recruitmentStatus: position.recruitmentStatus,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
      // Explicitly exclude opportunity, candidates, and other sensitive data
    };
  }

  async findAll(filters: FilterPositionsDto) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;

    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';
    this.validateSortField(sortBy);

    const where = this.buildWhereClause(filters);

    const result = await this.paginate(
      this.prisma.openPosition,
      where,
      {
        page,
        pageSize,
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
              lead: {
                select: {
                  id: true,
                  title: true,
                  leadType: true,
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
      }
    );

    return {
      ...result,
      data: result.data.map((position) => this.formatPosition(position)),
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
                leadType: true,
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
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Open position', id));
    }

    return this.formatPosition(position);
  }

  async update(id: string, updateDto: UpdatePositionDto) {
    const existingPosition = await this.ensurePositionExists(id);

    // If updating opportunityId, validate the new opportunity exists
    if (updateDto.opportunityId !== undefined && updateDto.opportunityId !== null && updateDto.opportunityId !== '') {
      const opportunity = await this.prisma.opportunity.findUnique({
        where: { id: updateDto.opportunityId },
      });

      if (!opportunity) {
        throw new NotFoundException(
          ErrorMessages.NOT_FOUND('Opportunity', updateDto.opportunityId),
        );
      }
    }

    const position = await this.prisma.openPosition.update({
      where: { id },
      data: {
        title: updateDto.title,
        description: updateDto.description,
        requirements: updateDto.requirements,
        status: updateDto.status,
        // Handle opportunityId update (can be null to unlink)
        ...(updateDto.opportunityId !== undefined
          ? { opportunityId: updateDto.opportunityId || null }
          : {}),
        // Handle recruitmentStatus update
        ...(updateDto.recruitmentStatus !== undefined
          ? { recruitmentStatus: updateDto.recruitmentStatus || null }
          : {}),
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
            lead: {
              select: {
                id: true,
                title: true,
                leadType: true,
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
            lead: {
              select: {
                id: true,
                title: true,
                leadType: true,
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

  async archive(id: string) {
    const position = await this.ensurePositionExists(id);

    if (position.isArchived) {
      throw new BadRequestException(ErrorMessages.OPERATION_NOT_ALLOWED('archive position', 'position is already archived'));
    }

    const updated = await this.prisma.openPosition.update({
      where: { id },
      data: {
        isArchived: true,
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
            lead: {
              select: {
                id: true,
                title: true,
                leadType: true,
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
    });

    return this.formatPosition(updated);
  }

  async unarchive(id: string) {
    const position = await this.ensurePositionExists(id);

    if (!position.isArchived) {
      throw new BadRequestException(ErrorMessages.OPERATION_NOT_ALLOWED('unarchive position', 'position is not archived'));
    }

    const updated = await this.prisma.openPosition.update({
      where: { id },
      data: {
        isArchived: false,
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
            lead: {
              select: {
                id: true,
                title: true,
                leadType: true,
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
    });

    return this.formatPosition(updated);
  }

  async remove(id: string) {
    await this.ensurePositionExists(id);

    // Check if position has linked candidates
    const candidateCount = await this.prisma.candidatePosition.count({
      where: { positionId: id },
    });

    if (candidateCount > 0) {
      throw new BadRequestException(
        ErrorMessages.OPERATION_NOT_ALLOWED('delete position', `position has ${candidateCount} linked candidate(s). Please unlink candidates first or archive the position`),
      );
    }

    await this.prisma.openPosition.delete({
      where: { id },
    });

    return { message: 'Position deleted successfully', id };
  }
}


