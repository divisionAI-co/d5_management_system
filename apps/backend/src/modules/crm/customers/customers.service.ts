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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { FilterCustomersDto } from './dto/filter-customers.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
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
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private static formatCustomer(customer: any) {
    const formatted = {
      ...customer,
      monthlyValue: customer?.monthlyValue
        ? Number(customer.monthlyValue)
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
      currency: createCustomerDto.currency ?? 'USD',
      notes: createCustomerDto.notes,
      tags: createCustomerDto.tags ?? [],
      odooId: createCustomerDto.odooId,
    };

    if (createCustomerDto.monthlyValue !== undefined) {
      data.monthlyValue = new Prisma.Decimal(createCustomerDto.monthlyValue);
    }

    const customer = await this.prisma.customer.create({ data });
    return this.findOne(customer.id);
  }

  private buildWhereClause(filters: FilterCustomersDto): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        { industry: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        { website: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    if (filters.type) {
      where.type = filters.type as CustomerType;
    }

    if (filters.status) {
      where.status = filters.status as CustomerStatus;
    }

    if (filters.sentiment) {
      where.sentiment = filters.sentiment as CustomerSentiment;
    }

    if (filters.country) {
      where.country = {
        equals: filters.country,
        mode: Prisma.QueryMode.insensitive,
      };
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasEvery: filters.tags };
    }

    return where;
  }

  async findAll(filters: FilterCustomersDto): Promise<PaginatedResult<any>> {
    const { page = 1, pageSize = 25 } = filters;
    const skip = (page - 1) * pageSize;

    const sortBy = (filters.sortBy ?? 'createdAt') as keyof Prisma.CustomerOrderByWithRelationInput;
    const sortOrder = filters.sortOrder ?? 'desc';

    if (!['name', 'createdAt', 'updatedAt', 'monthlyValue'].includes(sortBy)) {
      throw new BadRequestException(`Unsupported sort field: ${sortBy}`);
    }

    const where = this.buildWhereClause(filters);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
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
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: items.map(CustomersService.formatCustomer),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
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
      throw new NotFoundException(`Customer with ID ${id} not found`);
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

    return CustomersService.formatCustomer({
      ...customer,
      contacts,
    });
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
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
      currency: updateCustomerDto.currency,
      notes: updateCustomerDto.notes,
      tags: updateCustomerDto.tags,
      odooId: updateCustomerDto.odooId,
    };

    if (updateCustomerDto.monthlyValue !== undefined) {
      data.monthlyValue = new Prisma.Decimal(updateCustomerDto.monthlyValue);
    }

    await this.prisma.customer.update({
      where: { id },
      data,
    });

    return this.findOne(id);
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
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    await this.prisma.customer.delete({ where: { id } });
    return { deleted: true };
  }

  async getCustomerActivities(id: string, take = 20) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
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
      throw new NotFoundException(`Customer with ID ${id} not found`);
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
}


