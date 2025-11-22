import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerSentiment,
  CustomerStatus,
  CustomerType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { QueryBuilder } from '../../../common/utils/query-builder.util';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { FilterCustomersDto } from './dto/filter-customers.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { ACTIVITY_SUMMARY_INCLUDE, mapActivitySummary } from '../../activities/activity.mapper';
import { EncryptionService } from '../../../common/encryption/encryption.service';
import { extractDriveFolderId, generateDriveFolderUrl } from '../../../common/utils/drive-folder.util';

@Injectable()
export class CustomersService extends BaseService {
  constructor(
    prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {
    super(prisma);
  }

  private formatCustomer(customer: any) {
    const formatted = {
      ...customer,
      monthlyValue: customer?.monthlyValue
        ? Number(customer.monthlyValue)
        : null,
      // Decrypt sensitive fields
      taxId: customer?.taxId ? this.encryptionService.decrypt(customer.taxId) : null,
      registrationId: customer?.registrationId
        ? this.encryptionService.decrypt(customer.registrationId)
        : null,
      // Google Drive folder
      driveFolderId: customer?.driveFolderId ?? null,
      driveFolderUrl: customer?.driveFolderId
        ? generateDriveFolderUrl(customer.driveFolderId)
        : null,
    };

    const contacts = Array.isArray(customer?.contacts) ? customer.contacts : undefined;
    const invoices = Array.isArray(customer?.invoices) ? customer.invoices : undefined;
    const opportunities = Array.isArray(customer?.opportunities) ? customer.opportunities : undefined;

    if (contacts) {
      formatted.contacts = contacts;
    }

    if (invoices) {
      formatted.invoices = invoices.map((invoice: any) => ({
        ...invoice,
        total:
          invoice.total !== undefined && invoice.total !== null
            ? Number(invoice.total)
            : null,
      }));
    }

    if (opportunities) {
      formatted.opportunities = opportunities.map((opportunity: any) => ({
        ...opportunity,
        value:
          opportunity.value !== undefined && opportunity.value !== null
            ? Number(opportunity.value)
            : null,
      }));
    }

    const contactCount = contacts?.length ?? customer?._count?.contacts ?? 0;
    if ('_count' in formatted) {
      formatted._count = {
        ...(customer?._count ?? {}),
        contacts: contactCount,
      };
    } else if (contacts || customer?._count) {
      formatted._count = {
        ...(customer?._count ?? {}),
        contacts: contactCount,
      };
    }

    return formatted;
  }

  async create(createCustomerDto: CreateCustomerDto) {
    return this.handlePrismaError(async () => {
      const data: Prisma.CustomerCreateInput = {
        name: createCustomerDto.name,
        email: createCustomerDto.email.toLowerCase(),
        phone: createCustomerDto.phone,
        website: createCustomerDto.website,
        industry: createCustomerDto.industry,
        type: createCustomerDto.type,
        status: createCustomerDto.status ?? CustomerStatus.ONBOARDING,
        sentiment: createCustomerDto.sentiment ?? CustomerSentiment.NEUTRAL,
        address: createCustomerDto.address,
        city: createCustomerDto.city,
        country: createCustomerDto.country,
        postalCode: createCustomerDto.postalCode,
        taxId: this.encryptionService.encrypt(createCustomerDto.taxId),
        registrationId: this.encryptionService.encrypt(createCustomerDto.registrationId),
        currency: createCustomerDto.currency ?? 'USD',
        notes: createCustomerDto.notes,
        tags: createCustomerDto.tags ?? [],
        odooId: createCustomerDto.odooId,
        imageUrl: createCustomerDto.imageUrl,
        featured: createCustomerDto.featured ?? false,
      };

      if (createCustomerDto.monthlyValue !== undefined) {
        data.monthlyValue = new Prisma.Decimal(createCustomerDto.monthlyValue);
      }

      // Handle Google Drive folder ID
      const inputValue = createCustomerDto.driveFolderId ?? createCustomerDto.driveFolderUrl;
      const driveFolderId = extractDriveFolderId(inputValue);
      if (inputValue && !driveFolderId) {
        throw new BadRequestException(
          'Unable to extract Google Drive folder ID from the provided value. Please provide a valid folder URL or ID, not a file URL.',
        );
      }
      if (driveFolderId) {
        data.driveFolderId = driveFolderId;
      }

      const customer = await this.prisma.customer.create({ data });
      return this.findOne(customer.id);
    }, ErrorMessages.CREATE_FAILED('Customer'));
  }

  private buildWhereClause(filters: FilterCustomersDto): Prisma.CustomerWhereInput {
    const baseWhere = QueryBuilder.buildWhereClause<Prisma.CustomerWhereInput>(
      filters,
      {
        searchFields: ['name', 'email', 'industry', 'website'],
      },
    );

    // Handle special filters
    if (filters.country) {
      baseWhere.country = {
        equals: filters.country,
        mode: Prisma.QueryMode.insensitive,
      };
    }

    if (filters.tags && filters.tags.length > 0) {
      baseWhere.tags = { hasEvery: filters.tags };
    }

    return baseWhere;
  }

  async findAll(filters: FilterCustomersDto) {
    const { page = 1, pageSize = 25 } = filters;

    const sortBy = (filters.sortBy ?? 'createdAt') as keyof Prisma.CustomerOrderByWithRelationInput;
    const sortOrder = filters.sortOrder ?? 'desc';

    try {
      QueryBuilder.validateSortField(sortBy, ['name', 'createdAt', 'updatedAt', 'monthlyValue']);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : `Unsupported sort field: ${sortBy}`);
    }

    const where = this.buildWhereClause(filters);

    const result = await this.paginate(
      this.prisma.customer,
      where,
      {
        page,
        pageSize,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          _count: {
            select: {
              opportunities: true,
              invoices: true,
            },
          },
        },
      }
    );

    return {
      ...result,
      data: result.data.map((item) => this.formatCustomer(item)),
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            opportunities: true,
            invoices: true,
            activities: true,
            meetings: true,
          },
        },
        opportunities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        invoices: {
          orderBy: { dueDate: 'desc' },
          take: 5,
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
            dueDate: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Customer', id));
    }

    const contacts = await this.prisma.contact.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        companyName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.formatCustomer({
      ...customer,
      contacts,
    });
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    return this.handlePrismaError(async () => {
      const existing = await this.prisma.customer.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND('Customer', id));
      }

    const data: Prisma.CustomerUpdateInput = {
      name: updateCustomerDto.name,
      email: updateCustomerDto.email?.toLowerCase(),
      phone: updateCustomerDto.phone,
      website: updateCustomerDto.website,
      industry: updateCustomerDto.industry,
      type: updateCustomerDto.type,
      status: updateCustomerDto.status,
      sentiment: updateCustomerDto.sentiment,
      address: updateCustomerDto.address,
      city: updateCustomerDto.city,
      country: updateCustomerDto.country,
      postalCode: updateCustomerDto.postalCode,
      taxId:
        updateCustomerDto.taxId !== undefined
          ? this.encryptionService.encrypt(updateCustomerDto.taxId)
          : undefined,
      registrationId:
        updateCustomerDto.registrationId !== undefined
          ? this.encryptionService.encrypt(updateCustomerDto.registrationId)
          : undefined,
      currency: updateCustomerDto.currency,
      notes: updateCustomerDto.notes,
      tags: updateCustomerDto.tags,
      odooId: updateCustomerDto.odooId,
      imageUrl: updateCustomerDto.imageUrl,
      featured: updateCustomerDto.featured,
    };

    if (updateCustomerDto.monthlyValue !== undefined) {
      data.monthlyValue = new Prisma.Decimal(updateCustomerDto.monthlyValue);
    }

    // Handle Google Drive folder ID
    let driveFolderIdUpdate: string | null | undefined = undefined;
    if (
      updateCustomerDto.driveFolderId !== undefined ||
      updateCustomerDto.driveFolderUrl !== undefined
    ) {
      const inputValue = updateCustomerDto.driveFolderId ?? updateCustomerDto.driveFolderUrl;
      
      // If the input is an empty string or null, explicitly clear the field
      if (!inputValue || (typeof inputValue === 'string' && inputValue.trim().length === 0)) {
        driveFolderIdUpdate = null;
      } else {
        const resolved = extractDriveFolderId(inputValue);

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
    if (driveFolderIdUpdate !== undefined) {
      data.driveFolderId = driveFolderIdUpdate;
    }

      await this.prisma.customer.update({
        where: { id },
        data,
      });

      return this.findOne(id);
    }, ErrorMessages.UPDATE_FAILED('Customer'));
  }

  async updateStatus(id: string, updateStatusDto: UpdateCustomerStatusDto) {
    if (
      updateStatusDto.status === undefined &&
      updateStatusDto.sentiment === undefined
    ) {
      throw new BadRequestException(
        'Provide at least status or sentiment to update',
      );
    }

    await this.prisma.customer.update({
      where: { id },
      data: {
        status: updateStatusDto.status,
        sentiment: updateStatusDto.sentiment,
        notes: updateStatusDto.note ?? undefined,
      },
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    return this.handlePrismaError(async () => {
      const existing = await this.prisma.customer.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND('Customer', id));
      }

      await this.prisma.customer.delete({ where: { id } });
      return { deleted: true };
    }, ErrorMessages.DELETE_FAILED('Customer'));
  }

  async getCustomerActivities(id: string, take = 20) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Customer', id));
    }

    const activities = await this.prisma.activity.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take,
      include: ACTIVITY_SUMMARY_INCLUDE,
    });

    return activities.map((activity) => mapActivitySummary(activity as any));
  }

  async getCustomerOpportunities(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Customer', id));
    }

    const opportunities = await this.prisma.opportunity.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return opportunities.map((opportunity) => ({
      ...opportunity,
      value: Number(opportunity.value),
    }));
  }

  /**
   * Public method for website showcase - returns customer logos
   * Only returns active customers with logos
   */
  async getPublicLogos() {
    const customers = await this.prisma.customer.findMany({
      where: {
        status: CustomerStatus.ACTIVE,
        featured: true, // Only return featured customers
        imageUrl: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        website: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return customers.filter((customer) => customer.imageUrl !== null);
  }
}


