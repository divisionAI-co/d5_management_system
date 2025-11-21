import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerType,
  NotificationType,
  Prisma,
  RecruitmentStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { QueryBuilder } from '../../../common/utils/query-builder.util';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { EmailService } from '../../../common/email/email.service';
import { TemplatesService } from '../../templates/templates.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { UsersService } from '../../users/users.service';
import { extractMentionIdentifiers } from '../../../common/utils/mention-parser';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { FilterOpportunitiesDto } from './dto/filter-opportunities.dto';
import { CloseOpportunityDto } from './dto/close-opportunity.dto';
import { SendOpportunityEmailDto } from './dto/send-email.dto';
import { PreviewOpportunityEmailDto } from './dto/preview-email.dto';
import { ACTIVITY_SUMMARY_INCLUDE, mapActivitySummary } from '../../activities/activity.mapper';

@Injectable()
export class OpportunitiesService extends BaseService {
  constructor(
    prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly templatesService: TemplatesService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {
    super(prisma);
  }

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

    // Handle multiple positions - for backward compatibility, use first position
    if (opportunity?.openPositions && opportunity.openPositions.length > 0) {
      formatted.openPosition = opportunity.openPositions[0];
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
    // Use QueryBuilder for standard filters, but handle complex search manually
    const { search, ...baseFilters } = filters;
    
    const baseWhere = QueryBuilder.buildWhereClause<Prisma.OpportunityWhereInput>(
      baseFilters,
    );

    // Handle complex search across relations (manual implementation)
    if (search) {
      baseWhere.OR = [
        {
          title: {
            contains: search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          description: {
            contains: search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          lead: {
            title: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          lead: {
            contacts: {
              some: {
                contact: {
                  OR: [
                    {
                      firstName: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      lastName: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      companyName: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          customer: {
            name: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
      ];
    }

    // Handle stage filter with case-insensitive matching
    if (filters.stage) {
      baseWhere.stage = {
        equals: filters.stage,
        mode: Prisma.QueryMode.insensitive,
      };
    }

    return baseWhere;
  }

  private validateSortField(sortBy?: string) {
    try {
      QueryBuilder.validateSortField(sortBy, ['createdAt', 'updatedAt', 'value', 'stage', 'title']);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : `Unsupported sort field: ${sortBy}`);
    }
  }

  async findAll(filters: FilterOpportunitiesDto) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;

    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';
    this.validateSortField(sortBy);

    const where = this.buildWhereClause(filters);

    const result = await this.paginate(
      this.prisma.opportunity,
      where,
      {
        page,
        pageSize,
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
            include: {
              contacts: {
                include: {
                  contact: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true,
                    },
                  },
                },
              },
            },
          },
          openPositions: {
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }
    );

    return {
      ...result,
      data: result.data.map((opportunity) =>
        this.formatOpportunity(opportunity),
      ),
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
          include: {
            contacts: {
              include: {
                contact: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
        openPositions: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: ACTIVITY_SUMMARY_INCLUDE,
        },
      },
    });

    if (!opportunity) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Opportunity', id));
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
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Customer', customerId));
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
        contacts: {
          include: {
            contact: {
              select: {
                id: true,
                customerId: true,
                companyName: true,
              },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Lead', leadId));
    }

    return lead;
  }

  private readonly allowedAssigneeRoles = new Set<UserRole>([
    UserRole.ADMIN,
    UserRole.SALESPERSON,
  ]);

  private async ensureEligibleAssignee(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('User', userId));
    }

    if (!user.isActive) {
      throw new BadRequestException(ErrorMessages.OPERATION_NOT_ALLOWED('assign opportunity', 'user must be active'));
    }

    if (!this.allowedAssigneeRoles.has(user.role)) {
      throw new BadRequestException(
        ErrorMessages.OPERATION_NOT_ALLOWED('assign opportunity', 'only admins or salespeople can be assigned')
      );
    }
  }

  private shouldCreatePositionFromDto(
    dto: Partial<Pick<CreateOpportunityDto, 'positionTitle' | 'positionDescription' | 'positionRequirements'>>,
  ): boolean {
    return Boolean(
      dto.positionTitle?.trim() ||
        dto.positionDescription?.trim() ||
        dto.positionRequirements?.trim(),
    );
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

  async create(createDto: CreateOpportunityDto, createdById: string) {
    const lead = await this.findLeadContext(createDto.leadId);

    let resolvedCustomerId = createDto.customerId ?? undefined;

    if (lead.convertedCustomerId) {
      if (
        resolvedCustomerId &&
        resolvedCustomerId !== lead.convertedCustomerId
      ) {
        throw new BadRequestException(
          ErrorMessages.OPERATION_NOT_ALLOWED('convert lead', 'lead is already converted to a different customer')
        );
      }
      resolvedCustomerId = lead.convertedCustomerId ?? undefined;
    }

    // Check if any contact belongs to a different customer
    if (resolvedCustomerId && lead.contacts && lead.contacts.length > 0) {
      const contactWithDifferentCustomer = lead.contacts.find(
        (lc) => lc.contact.customerId && lc.contact.customerId !== resolvedCustomerId
      );
      if (contactWithDifferentCustomer) {
        throw new BadRequestException(
          ErrorMessages.OPERATION_NOT_ALLOWED('convert lead', 'lead contact belongs to a different customer')
        );
      }
    }

    const _customer = await this.findCustomerSummary(resolvedCustomerId);

    if (createDto.assignedToId) {
      await this.ensureEligibleAssignee(createDto.assignedToId);
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

      // Create positions - support both new array format and legacy single position format
      const positionsToCreate: Array<{
        title: string;
        description?: string;
        requirements?: string;
        recruitmentStatus?: 'HEADHUNTING' | 'STANDARD';
      }> = [];

      if (createDto.positions && createDto.positions.length > 0) {
        // New format: array of positions
        positionsToCreate.push(...createDto.positions);
      } else if (this.shouldCreatePositionFromDto(createDto)) {
        // Legacy format: single position from positionTitle/positionDescription/positionRequirements
        positionsToCreate.push({
          title: createDto.positionTitle ?? createDto.title,
          description: createDto.positionDescription ?? createDto.description ?? 'TBD',
          requirements: createDto.positionRequirements,
        });
      }

      if (positionsToCreate.length > 0) {
        await tx.openPosition.createMany({
          data: positionsToCreate.map((pos) => {
            let recruitmentStatus: RecruitmentStatus | null = null;
            if (pos.recruitmentStatus && pos.recruitmentStatus.trim() !== '') {
              const statusValue = pos.recruitmentStatus.trim();
              if (statusValue === 'HEADHUNTING' || statusValue === 'STANDARD') {
                recruitmentStatus = statusValue as RecruitmentStatus;
              }
            }
            return {
              opportunityId: opportunity.id,
              title: pos.title,
              description: pos.description ?? 'TBD',
              requirements: pos.requirements,
              recruitmentStatus,
              status: 'Open',
            };
          }),
        });
      }

      if (
        createDto.type === CustomerType.STAFF_AUGMENTATION ||
        createDto.type === CustomerType.BOTH
      ) {
        await this.notifyRecruiters(tx, {
          opportunityId: opportunity.id,
          opportunityTitle: createDto.title,
          customerName: _customer?.name ?? (lead.contacts && lead.contacts.length > 0 ? lead.contacts[0].contact.companyName : undefined) ?? undefined,
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
            include: {
              contacts: {
                include: {
                  contact: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true,
                    },
                  },
                },
              },
            },
          },
          openPositions: true,
        },
      });

      return this.formatOpportunity(created);
    }).then((formatted) => {
      // Process @mentions in title and description if provided
      // Do this outside the transaction to avoid scoping issues
      if (createDto.title || createDto.description) {
        this.processMentions(formatted.id, createDto.title, createDto.description, createdById).catch((error) => {
          this.logger.error(`[Mentions] Failed to process mentions for opportunity ${formatted.id}:`, error);
        });
      }
      return formatted;
    });
  }

  async update(id: string, updateDto: UpdateOpportunityDto, updatedById: string) {
    const existing = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        openPositions: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Opportunity', id));
    }

    const targetLeadId = updateDto.leadId ?? existing.leadId;
    if (!targetLeadId) {
      throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('lead (opportunity must be associated with a lead)'));
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
          ErrorMessages.OPERATION_NOT_ALLOWED('convert lead', 'lead is already converted to a different customer')
        );
      }
      resolvedCustomerId = lead.convertedCustomerId ?? undefined;
    }

    // Check if any contact belongs to a different customer
    if (resolvedCustomerId && lead.contacts && lead.contacts.length > 0) {
      const contactWithDifferentCustomer = lead.contacts.find(
        (lc) => lc.contact.customerId && lc.contact.customerId !== resolvedCustomerId
      );
      if (contactWithDifferentCustomer) {
        throw new BadRequestException(
          ErrorMessages.OPERATION_NOT_ALLOWED('convert lead', 'lead contact belongs to a different customer')
        );
      }
    }

    const _customer = await this.findCustomerSummary(resolvedCustomerId);

    if (
      updateDto.assignedToId &&
      updateDto.assignedToId !== existing.assignedToId
    ) {
      await this.ensureEligibleAssignee(updateDto.assignedToId);
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
      const shouldCreatePosition = this.shouldCreatePositionFromDto(updateDto);

      // Handle positions - support both new array format and legacy single position format
      const positionsToCreate: Array<{
        title: string;
        description?: string;
        requirements?: string;
        recruitmentStatus?: 'HEADHUNTING' | 'STANDARD';
      }> = [];

      if (updateDto.positions && updateDto.positions.length > 0) {
        // New format: array of positions - create new ones
        positionsToCreate.push(...updateDto.positions);
      } else if (shouldCreatePosition) {
        // Legacy format: single position from positionTitle/positionDescription/positionRequirements
        positionsToCreate.push({
          title: updateDto.positionTitle ?? updateDto.title ?? updated.title,
          description: updateDto.positionDescription ?? updateDto.description ?? updated.description ?? 'TBD',
          requirements: updateDto.positionRequirements,
        });
      }

      // Handle existing positions
      const firstPosition = existing.openPositions && existing.openPositions.length > 0 ? existing.openPositions[0] : null;
      
      if (firstPosition) {
        if (positionsToCreate.length > 0) {
          // Update first position if using legacy format, otherwise create new ones
          if (!updateDto.positions) {
            await tx.openPosition.update({
              where: { id: firstPosition.id },
              data: {
                title: positionsToCreate[0].title,
                description: positionsToCreate[0].description ?? 'TBD',
                requirements: positionsToCreate[0].requirements,
              },
            });
          }
        }

        if (!requiresOpenPosition) {
          // Cancel all positions if opportunity type no longer requires them
          await tx.openPosition.updateMany({
            where: { opportunityId: updated.id },
            data: {
              status: 'Cancelled',
              ...(positionFieldsProvided && !updateDto.positions && firstPosition
                ? {
                    title: updateDto.positionTitle ?? updateDto.title ?? firstPosition.title,
                    description: updateDto.positionDescription ?? updateDto.description ?? firstPosition.description,
                    requirements: updateDto.positionRequirements ?? firstPosition.requirements,
                  }
                : {}),
            },
          });
        }
      }

      // Create new positions if provided
      if (positionsToCreate.length > 0 && (updateDto.positions || !firstPosition)) {
        await tx.openPosition.createMany({
          data: positionsToCreate.map((pos) => {
            let recruitmentStatus: RecruitmentStatus | null = null;
            if (pos.recruitmentStatus && pos.recruitmentStatus.trim() !== '') {
              const statusValue = pos.recruitmentStatus.trim();
              if (statusValue === 'HEADHUNTING' || statusValue === 'STANDARD') {
                recruitmentStatus = statusValue as RecruitmentStatus;
              }
            }
            return {
              opportunityId: updated.id,
              title: pos.title,
              description: pos.description ?? 'TBD',
              requirements: pos.requirements,
              recruitmentStatus,
              status: 'Open',
            };
          }),
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
            include: {
              contacts: {
                include: {
                  contact: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true,
                    },
                  },
                },
              },
            },
          },
          openPositions: true,
        },
      });

      if (!result) {
        throw new NotFoundException(ErrorMessages.UPDATE_FAILED('Opportunity'));
      }

      return this.formatOpportunity(result);
    }).then((formatted) => {
      // Process mentions after transaction completes
      if (updateDto.title !== undefined || updateDto.description !== undefined) {
        const title = updateDto.title ?? formatted.title;
        const description = updateDto.description ?? formatted.description;
        this.processMentions(id, title, description, updatedById).catch((error) => {
          this.logger.error(`[Mentions] Failed to process mentions for opportunity ${id}:`, error);
        });
      }
      return formatted;
    });
  }

  async close(id: string, closeDto: CloseOpportunityDto) {
    const existing = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        openPositions: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Opportunity', id));
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

      // Cancel all positions if opportunity is lost
      if (existing.openPositions && existing.openPositions.length > 0 && closeDto.isWon === false) {
        await tx.openPosition.updateMany({
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
            include: {
              contacts: {
                include: {
                  contact: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true,
                    },
                  },
                },
              },
            },
          },
          openPositions: true,
        },
      });

      return this.formatOpportunity(result);
    });
  }

  async sendEmail(id: string, dto: SendOpportunityEmailDto) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            country: true,
            postalCode: true,
          },
        },
        lead: {
          include: {
            contacts: {
              include: {
                contact: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    role: true,
                    companyName: true,
                  },
                },
              },
            },
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
        openPositions: {
          select: {
            id: true,
            title: true,
            description: true,
            requirements: true,
          },
        },
      },
    });

    if (!opportunity) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Opportunity', id));
    }

    let htmlContent = dto.htmlContent;
    let textContent = dto.textContent;

    // If template is provided, render it with opportunity data
    if (dto.templateId) {
      const templateData = {
        opportunity: {
          id: opportunity.id,
          title: opportunity.title,
          description: opportunity.description,
          type: opportunity.type,
          value: opportunity.value ? Number(opportunity.value) : null,
          stage: opportunity.stage,
          isClosed: opportunity.isClosed,
          isWon: opportunity.isWon,
          createdAt: opportunity.createdAt,
          updatedAt: opportunity.updatedAt,
          closedAt: opportunity.closedAt,
          jobDescriptionUrl: opportunity.jobDescriptionUrl,
        },
        customer: opportunity.customer
          ? {
              id: opportunity.customer.id,
              name: opportunity.customer.name,
              email: opportunity.customer.email,
              phone: opportunity.customer.phone,
              address: opportunity.customer.address,
              city: opportunity.customer.city,
              country: opportunity.customer.country,
              postalCode: opportunity.customer.postalCode,
            }
          : null,
        lead: opportunity.lead
          ? {
              id: opportunity.lead.id,
              title: opportunity.lead.title,
              contact: opportunity.lead.contacts && opportunity.lead.contacts.length > 0
                ? {
                    firstName: opportunity.lead.contacts[0].contact.firstName,
                    lastName: opportunity.lead.contacts[0].contact.lastName,
                    email: opportunity.lead.contacts[0].contact.email,
                    phone: opportunity.lead.contacts[0].contact.phone,
                    role: opportunity.lead.contacts[0].contact.role,
                    companyName: opportunity.lead.contacts[0].contact.companyName,
                  }
                : null,
            }
          : null,
        assignedTo: opportunity.assignedTo
          ? {
              firstName: opportunity.assignedTo.firstName,
              lastName: opportunity.assignedTo.lastName,
              email: opportunity.assignedTo.email,
            }
          : null,
        position: opportunity.openPositions && opportunity.openPositions.length > 0
          ? {
              title: opportunity.openPositions[0].title,
              description: opportunity.openPositions[0].description,
              requirements: opportunity.openPositions[0].requirements,
            }
          : null,
      };

      try {
        const rendered = await this.templatesService.render(dto.templateId, templateData);
        htmlContent = rendered.html;
        textContent = rendered.text;
      } catch (templateError) {
        this.logger.warn(
          `[Opportunities] Failed to render email template ${dto.templateId}, falling back to default HTML:`,
          templateError,
        );
        // Fallback to default HTML template
        htmlContent = this.getDefaultOpportunityEmailTemplate(opportunity, templateData);
        textContent = this.getDefaultOpportunityEmailText(opportunity, templateData);
      }
    } else if (!htmlContent) {
      throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('templateId or htmlContent'));
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
      throw new BadRequestException(ErrorMessages.OPERATION_NOT_ALLOWED('send email', 'email service failed'));
    }

    return {
      success: true,
      message: 'Email sent successfully',
      to: dto.to,
      subject: dto.subject,
    };
  }

  async previewEmail(id: string, dto: PreviewOpportunityEmailDto) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            country: true,
            postalCode: true,
          },
        },
        lead: {
          include: {
            contacts: {
              include: {
                contact: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    role: true,
                    companyName: true,
                  },
                },
              },
            },
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
        openPositions: {
          select: {
            id: true,
            title: true,
            description: true,
            requirements: true,
          },
        },
      },
    });

    if (!opportunity) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Opportunity', id));
    }

    let htmlContent = dto.htmlContent;
    let textContent = dto.textContent;

    // If template is provided, render it with opportunity data
    if (dto.templateId) {
      const templateData = {
        opportunity: {
          id: opportunity.id,
          title: opportunity.title,
          description: opportunity.description,
          type: opportunity.type,
          value: opportunity.value ? Number(opportunity.value) : null,
          stage: opportunity.stage,
          isClosed: opportunity.isClosed,
          isWon: opportunity.isWon,
          createdAt: opportunity.createdAt,
          updatedAt: opportunity.updatedAt,
          closedAt: opportunity.closedAt,
          jobDescriptionUrl: opportunity.jobDescriptionUrl,
        },
        customer: opportunity.customer
          ? {
              id: opportunity.customer.id,
              name: opportunity.customer.name,
              email: opportunity.customer.email,
              phone: opportunity.customer.phone,
              address: opportunity.customer.address,
              city: opportunity.customer.city,
              country: opportunity.customer.country,
              postalCode: opportunity.customer.postalCode,
            }
          : null,
        lead: opportunity.lead
          ? {
              id: opportunity.lead.id,
              title: opportunity.lead.title,
              contact: opportunity.lead.contacts && opportunity.lead.contacts.length > 0
                ? {
                    firstName: opportunity.lead.contacts[0].contact.firstName,
                    lastName: opportunity.lead.contacts[0].contact.lastName,
                    email: opportunity.lead.contacts[0].contact.email,
                    phone: opportunity.lead.contacts[0].contact.phone,
                    role: opportunity.lead.contacts[0].contact.role,
                    companyName: opportunity.lead.contacts[0].contact.companyName,
                  }
                : null,
            }
          : null,
        assignedTo: opportunity.assignedTo
          ? {
              firstName: opportunity.assignedTo.firstName,
              lastName: opportunity.assignedTo.lastName,
              email: opportunity.assignedTo.email,
            }
          : null,
        position: opportunity.openPositions && opportunity.openPositions.length > 0
          ? {
              title: opportunity.openPositions[0].title,
              description: opportunity.openPositions[0].description,
              requirements: opportunity.openPositions[0].requirements,
            }
          : null,
      };

      try {
        const rendered = await this.templatesService.render(dto.templateId, templateData);
        htmlContent = rendered.html;
        textContent = rendered.text;
      } catch (templateError) {
        this.logger.warn(
          `[Opportunities] Failed to render email template ${dto.templateId} for preview:`,
          templateError,
        );
        // Fallback to default HTML template
        htmlContent = this.getDefaultOpportunityEmailTemplate(opportunity, templateData);
        textContent = this.getDefaultOpportunityEmailText(opportunity, templateData);
      }
    } else if (!htmlContent) {
      // For preview, if no template and no HTML, return empty
      htmlContent = '';
      textContent = '';
    }

    // Convert line breaks to <br> tags for HTML content if it's plain text
    if (htmlContent && !htmlContent.includes('<') && !htmlContent.includes('>')) {
      htmlContent = htmlContent.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '<br>').join('');
    }

    return {
      html: htmlContent || '',
      text: textContent || '',
    };
  }

  private getDefaultOpportunityEmailTemplate(opportunity: any, templateData: any): string {
    const customerName = templateData.customer?.name || 'N/A';
    const value = templateData.opportunity.value
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(templateData.opportunity.value)
      : 'N/A';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; color: #6b7280; margin-bottom: 5px; }
          .value { color: #111827; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">${opportunity.title}</h1>
        </div>
        <div class="content">
          ${templateData.opportunity.description ? `
          <div class="section">
            <div class="label">Description:</div>
            <div class="value">${templateData.opportunity.description.replace(/\n/g, '<br>')}</div>
          </div>
          ` : ''}
          <div class="section">
            <div class="label">Customer:</div>
            <div class="value">${customerName}</div>
          </div>
          <div class="section">
            <div class="label">Stage:</div>
            <div class="value">${templateData.opportunity.stage || 'N/A'}</div>
          </div>
          <div class="section">
            <div class="label">Value:</div>
            <div class="value">${value}</div>
          </div>
          ${templateData.position ? `
          <div class="section">
            <div class="label">Position:</div>
            <div class="value">${templateData.position.title || 'N/A'}</div>
          </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  }

  private getDefaultOpportunityEmailText(opportunity: any, templateData: any): string {
    const customerName = templateData.customer?.name || 'N/A';
    const value = templateData.opportunity.value
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(templateData.opportunity.value)
      : 'N/A';

    return `${opportunity.title}

${templateData.opportunity.description ? `Description:\n${templateData.opportunity.description}\n\n` : ''}Customer: ${customerName}
Stage: ${templateData.opportunity.stage || 'N/A'}
Value: ${value}
${templateData.position ? `Position: ${templateData.position.title || 'N/A'}\n` : ''}`;
  }

  async remove(id: string) {
    await this.prisma.opportunity.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Process @mentions in opportunity description and create notifications
   */
  private async processMentions(
    opportunityId: string,
    title: string | null | undefined,
    description: string | null | undefined,
    createdById: string,
  ) {
    try {
      // Combine title and description to extract all mentions
      const text = [title, description].filter(Boolean).join(' ');
      if (!text) {
        return;
      }

      // Extract mention identifiers
      const identifiers = extractMentionIdentifiers(text);
      if (identifiers.length === 0) {
        return;
      }

      this.logger.log(`[Mentions] Processing mentions for opportunity ${opportunityId}:`, {
        identifiers,
        textPreview: text.substring(0, 100),
      });

      // Find users by mentions
      const mentionedUserIds = await this.usersService.findUsersByMentions(identifiers);
      
      this.logger.log(`[Mentions] Found ${mentionedUserIds.length} users for mentions:`, mentionedUserIds);
      
      // Remove the creator from mentioned users (they don't need to be notified about their own mentions)
      const userIdsToNotify = mentionedUserIds.filter((id) => id !== createdById);
      
      if (userIdsToNotify.length === 0) {
        this.logger.log(`[Mentions] No users to notify (all mentions were by creator or no matches found)`);
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

      // Create notifications for mentioned users
      const titlePreview = title ? (title.length > 50 ? title.substring(0, 50) + '...' : title) : 'an opportunity';
      
      const notifications = await this.notificationsService.createNotificationsForUsers(
        userIdsToNotify,
        NotificationType.MENTIONED_IN_ACTIVITY,
        `You were mentioned in an opportunity`,
        `${creatorName} mentioned you in opportunity "${titlePreview}"`,
        'opportunity',
        opportunityId,
      );

      this.logger.log(`[Mentions] Created ${notifications.length} notifications for opportunity ${opportunityId}`);
    } catch (error) {
      // Log error but don't fail the opportunity creation/update
      this.logger.error(`[Mentions] Error processing mentions for opportunity ${opportunityId}:`, error);
    }
  }
}


