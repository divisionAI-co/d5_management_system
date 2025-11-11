import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerType,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { FilterOpportunitiesDto } from './dto/filter-opportunities.dto';
import { CloseOpportunityDto } from './dto/close-opportunity.dto';
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
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private formatOpportunity(opportunity: any) {
    if (!opportunity) {
      return opportunity;
    }

    const formatted = {
      ...opportunity,
      value:
        opportunity?.value !== undefined && opportunity?.value !== null
          ? Number(opportunity.value)
          : null,
    };

    if (opportunity?.openPosition) {
      formatted.openPosition = opportunity.openPosition;
    }

    if (Array.isArray(opportunity?.activities)) {
      formatted.activities = opportunity.activities.map((activity: any) =>
        mapActivitySummary(activity),
      );
    }

    return formatted;
  }

  private buildWhereClause(
    filters: FilterOpportunitiesDto,
  ): Prisma.OpportunityWhereInput {
    const where: Prisma.OpportunityWhereInput = {};

    if (filters.search) {
      where.OR = [
        {
          title: {
            contains: filters.search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          description: {
            contains: filters.search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          lead: {
            title: {
              contains: filters.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          lead: {
            contact: {
              OR: [
                {
                  firstName: {
                    contains: filters.search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  lastName: {
                    contains: filters.search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  companyName: {
                    contains: filters.search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            },
          },
        },
        {
          customer: {
            name: {
              contains: filters.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
      ];
    }

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.assignedToId) {
      where.assignedToId = filters.assignedToId;
    }

    if (filters.leadId) {
      where.leadId = filters.leadId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.stage) {
      where.stage = {
        equals: filters.stage,
        mode: Prisma.QueryMode.insensitive,
      };
    }

    if (filters.isClosed !== undefined) {
      where.isClosed = filters.isClosed;
    }

    if (filters.isWon !== undefined) {
      where.isWon = filters.isWon;
    }

    return where;
  }

  private validateSortField(sortBy?: string) {
    if (!sortBy) {
      return;
    }

    const allowed = ['createdAt', 'updatedAt', 'value', 'stage', 'title'];
    if (!allowed.includes(sortBy)) {
      throw new BadRequestException(`Unsupported sort field: ${sortBy}`);
    }
  }

  async findAll(
    filters: FilterOpportunitiesDto,
  ): Promise<PaginatedResult<any>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';
    this.validateSortField(sortBy);

    const where = this.buildWhereClause(filters);

    const [total, opportunities] = await this.prisma.$transaction([
      this.prisma.opportunity.count({ where }),
      this.prisma.opportunity.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          lead: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          openPosition: {
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
    ]);

    return {
      data: opportunities.map((opportunity) =>
        this.formatOpportunity(opportunity),
      ),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        openPosition: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: ACTIVITY_SUMMARY_INCLUDE,
        },
      },
    });

    if (!opportunity) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    return this.formatOpportunity(opportunity);
  }

  private async findCustomerSummary(customerId?: string) {
    if (!customerId) {
      return null;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    return customer;
  }

  private async findLeadContext(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        title: true,
        status: true,
        convertedCustomerId: true,
        contact: {
          select: {
            id: true,
            customerId: true,
            companyName: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    return lead;
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }

  private async notifyRecruiters(
    tx: Prisma.TransactionClient,
    params: {
      opportunityId: string;
      opportunityTitle: string;
      customerName?: string;
    },
  ) {
    const recruiters = await tx.user.findMany({
      where: {
        role: UserRole.RECRUITER,
        isActive: true,
      },
      select: { id: true },
    });

    if (!recruiters.length) {
      return;
    }

    await tx.notification.createMany({
      data: recruiters.map((recruiter) => ({
        userId: recruiter.id,
        type: NotificationType.NEW_OPPORTUNITY,
        title: 'New staff augmentation opportunity',
        message: `A new staff augmentation opportunity "${params.opportunityTitle}" has been created${
          params.customerName ? ` for ${params.customerName}` : ''
        }.`,
        entityType: 'opportunity',
        entityId: params.opportunityId,
      })),
    });
  }

  async create(createDto: CreateOpportunityDto) {
    const lead = await this.findLeadContext(createDto.leadId);

    let resolvedCustomerId = createDto.customerId ?? undefined;

    if (lead.convertedCustomerId) {
      if (
        resolvedCustomerId &&
        resolvedCustomerId !== lead.convertedCustomerId
      ) {
        throw new BadRequestException(
          'Lead is already converted to a different customer',
        );
      }
      resolvedCustomerId = lead.convertedCustomerId ?? undefined;
    }

    if (
      resolvedCustomerId &&
      lead.contact?.customerId &&
      lead.contact.customerId !== resolvedCustomerId
    ) {
      throw new BadRequestException(
        'Lead contact belongs to a different customer',
      );
    }

    const customer = await this.findCustomerSummary(resolvedCustomerId);

    if (createDto.assignedToId) {
      await this.ensureUserExists(createDto.assignedToId);
    }

    return this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.create({
        data: {
          leadId: lead.id,
          ...(resolvedCustomerId !== undefined
            ? { customerId: resolvedCustomerId }
            : {}),
          title: createDto.title,
          description: createDto.description,
          type: createDto.type,
          value:
            createDto.value !== undefined && createDto.value !== null
              ? new Prisma.Decimal(createDto.value)
              : new Prisma.Decimal(0),
          assignedToId: createDto.assignedToId,
          jobDescriptionUrl: createDto.jobDescriptionUrl,
          stage: createDto.stage,
          isClosed: createDto.isClosed ?? false,
          isWon: createDto.isWon ?? false,
        } as Prisma.OpportunityUncheckedCreateInput,
      });

      if (
        createDto.type === CustomerType.STAFF_AUGMENTATION ||
        createDto.type === CustomerType.BOTH
      ) {
        await tx.openPosition.create({
          data: {
            opportunityId: opportunity.id,
            title: createDto.positionTitle ?? createDto.title,
            description:
              createDto.positionDescription ??
              createDto.description ??
              'TBD',
            requirements: createDto.positionRequirements,
            status: 'Open',
          },
        });

        await this.notifyRecruiters(tx, {
          opportunityId: opportunity.id,
          opportunityTitle: createDto.title,
          customerName: customer?.name ?? lead.contact?.companyName ?? undefined,
        });
      }

      const created = await tx.opportunity.findUnique({
        where: { id: opportunity.id },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          lead: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          openPosition: true,
        },
      });

      return this.formatOpportunity(created);
    });
  }

  async update(id: string, updateDto: UpdateOpportunityDto) {
    const existing = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        openPosition: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    const targetLeadId = updateDto.leadId ?? existing.leadId;
    if (!targetLeadId) {
      throw new BadRequestException('Opportunity must be associated with a lead');
    }

    const lead = await this.findLeadContext(targetLeadId);

    let resolvedCustomerId =
      updateDto.customerId !== undefined
        ? updateDto.customerId ?? undefined
        : existing.customerId ?? undefined;

    if (lead.convertedCustomerId) {
      if (
        resolvedCustomerId &&
        resolvedCustomerId !== lead.convertedCustomerId
      ) {
        throw new BadRequestException(
          'Lead is already converted to a different customer',
        );
      }
      resolvedCustomerId = lead.convertedCustomerId ?? undefined;
    }

    if (
      resolvedCustomerId &&
      lead.contact?.customerId &&
      lead.contact.customerId !== resolvedCustomerId
    ) {
      throw new BadRequestException(
        'Lead contact belongs to a different customer',
      );
    }

    const customer = await this.findCustomerSummary(resolvedCustomerId);

    if (
      updateDto.assignedToId &&
      updateDto.assignedToId !== existing.assignedToId
    ) {
      await this.ensureUserExists(updateDto.assignedToId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.opportunity.update({
        where: { id },
        data: {
          leadId: targetLeadId,
          ...(resolvedCustomerId !== undefined
            ? { customerId: resolvedCustomerId }
            : {}),
          title: updateDto.title ?? existing.title,
          description: updateDto.description ?? existing.description,
          type: updateDto.type ?? existing.type,
          value:
            updateDto.value !== undefined && updateDto.value !== null
              ? new Prisma.Decimal(updateDto.value)
              : undefined,
          assignedToId: updateDto.assignedToId ?? existing.assignedToId,
          jobDescriptionUrl:
            updateDto.jobDescriptionUrl ?? existing.jobDescriptionUrl,
          stage: updateDto.stage ?? existing.stage,
          isClosed: updateDto.isClosed ?? existing.isClosed,
          isWon: updateDto.isWon ?? existing.isWon,
        } as Prisma.OpportunityUncheckedUpdateInput,
      });

      const nextType = updateDto.type ?? updated.type;
      const requiresOpenPosition =
        nextType === CustomerType.STAFF_AUGMENTATION ||
        nextType === CustomerType.BOTH;
      const positionFieldsProvided =
        updateDto.positionTitle !== undefined ||
        updateDto.positionDescription !== undefined ||
        updateDto.positionRequirements !== undefined ||
        updateDto.description !== undefined ||
        updateDto.title !== undefined;

      if (requiresOpenPosition) {
        await tx.openPosition.upsert({
          where: { opportunityId: updated.id },
          update: {
            title: updateDto.positionTitle ?? updateDto.title ?? updated.title,
            description:
              updateDto.positionDescription ??
              updateDto.description ??
              updated.description ??
              'TBD',
            requirements: updateDto.positionRequirements,
          },
          create: {
            opportunityId: updated.id,
            title: updateDto.positionTitle ?? updateDto.title ?? updated.title,
            description:
              updateDto.positionDescription ??
              updateDto.description ??
              updated.description ??
              'TBD',
            requirements: updateDto.positionRequirements,
            status: 'Open',
          },
        });
      } else if (existing.openPosition) {
        await tx.openPosition.update({
          where: { opportunityId: existing.id },
          data: {
            status: 'Cancelled',
            ...(positionFieldsProvided
              ? {
                  title:
                    updateDto.positionTitle ??
                    updateDto.title ??
                    existing.openPosition.title,
                  description:
                    updateDto.positionDescription ??
                    updateDto.description ??
                    existing.openPosition.description,
                  requirements:
                    updateDto.positionRequirements ??
                    existing.openPosition.requirements,
                }
              : {}),
          },
        });
      }

      const result = await tx.opportunity.findUnique({
        where: { id: updated.id },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          lead: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          openPosition: true,
        },
      });

      return this.formatOpportunity(result);
    });
  }

  async close(id: string, closeDto: CloseOpportunityDto) {
    const existing = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        openPosition: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const closedAt =
        closeDto.closedAt !== undefined
          ? new Date(closeDto.closedAt)
          : existing.closedAt ?? new Date();

      const updated = await tx.opportunity.update({
        where: { id },
        data: {
          isClosed: true,
          isWon: closeDto.isWon,
          stage: closeDto.stage ?? (closeDto.isWon ? 'Closed Won' : 'Closed Lost'),
          closedAt,
        },
      });

      if (existing.openPosition && closeDto.isWon === false) {
        await tx.openPosition.update({
          where: { opportunityId: id },
          data: {
            status: 'Cancelled',
          },
        });
      }

      const result = await tx.opportunity.findUnique({
        where: { id: updated.id },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          lead: {
            select: {
              id: true,
              title: true,
            },
          },
          openPosition: true,
        },
      });

      return this.formatOpportunity(result);
    });
  }

  async remove(id: string) {
    await this.prisma.opportunity.delete({ where: { id } });
    return { deleted: true };
  }
}


