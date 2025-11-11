import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerSentiment, CustomerStatus, CustomerType, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { FilterLeadsDto } from './dto/filter-leads.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { ACTIVITY_SUMMARY_INCLUDE, mapActivitySummary } from '../../activities/activity.mapper';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private formatLead(lead: any) {
    if (!lead) return lead;

    const formatted = {
      ...lead,
      value: lead?.value ? Number(lead.value) : null,
    };

    if (Array.isArray(lead?.opportunities)) {
      formatted.opportunities = lead.opportunities.map((opportunity: any) => ({
        ...opportunity,
        value:
          opportunity.value !== undefined && opportunity.value !== null
            ? Number(opportunity.value)
            : null,
      }));
    }

    if (Array.isArray(lead?.activities)) {
      formatted.activities = lead.activities.map((activity: any) =>
        mapActivitySummary(activity),
      );
    }

    return formatted;
  }

  private async resolveContact(createDto: CreateLeadDto): Promise<string> {
    if (createDto.contactId) {
      const existing = await this.prisma.contact.findUnique({ where: { id: createDto.contactId } });
      if (!existing) {
        throw new NotFoundException(`Contact ${createDto.contactId} not found`);
      }
      return existing.id;
    }

    if (!createDto.contact) {
      throw new BadRequestException('Either contactId or contact details must be provided');
    }

    const existingByEmail = await this.prisma.contact.findUnique({ where: { email: createDto.contact.email } });
    if (existingByEmail) {
      return existingByEmail.id;
    }

    const { customerId, ...contactData } = createDto.contact;
    const newContact = await this.prisma.contact.create({
      data: {
        ...contactData,
        customerId,
      },
    });

    return newContact.id;
  }

  private buildWhereClause(filters: FilterLeadsDto): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = {};

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        {
          contact: {
            OR: [
              { firstName: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
              { lastName: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
              { companyName: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
            ],
          },
        },
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.assignedToId) {
      where.assignedToId = filters.assignedToId;
    }

    if (filters.contactId) {
      where.contactId = filters.contactId;
    }

    if (filters.convertedCustomerId) {
      where.convertedCustomerId = filters.convertedCustomerId;
    }

    return where;
  }

  async create(createLeadDto: CreateLeadDto) {
    const contactId = await this.resolveContact(createLeadDto);

    const lead = await this.prisma.lead.create({
      data: {
        contactId,
        title: createLeadDto.title,
        description: createLeadDto.description,
        status: createLeadDto.status ?? LeadStatus.NEW,
        value:
          createLeadDto.value !== undefined && createLeadDto.value !== null
            ? new Prisma.Decimal(createLeadDto.value)
            : undefined,
        probability: createLeadDto.probability,
        assignedToId: createLeadDto.assignedToId,
        source: createLeadDto.source,
        expectedCloseDate: createLeadDto.expectedCloseDate
          ? new Date(createLeadDto.expectedCloseDate)
          : undefined,
        prospectCompanyName: createLeadDto.prospectCompanyName,
        prospectWebsite: createLeadDto.prospectWebsite,
        prospectIndustry: createLeadDto.prospectIndustry,
      },
    });

    return this.findOne(lead.id);
  }

  async findAll(filters: FilterLeadsDto) {
    const { page = 1, pageSize = 25 } = filters;
    const skip = (page - 1) * pageSize;

    const where = this.buildWhereClause(filters);

    const orderBy: Prisma.LeadOrderByWithRelationInput = {
      [filters.sortBy ?? 'createdAt']: filters.sortOrder ?? 'desc',
    };

    const [total, leads] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
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
              customerId: true,
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
          convertedCustomer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      data: leads.map((lead) => this.formatLead(lead)),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
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
            customerId: true,
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
        convertedCustomer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        opportunities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            stage: true,
            value: true,
            createdAt: true,
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: ACTIVITY_SUMMARY_INCLUDE,
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    return this.formatLead(lead);
  }

  async update(id: string, updateDto: UpdateLeadDto) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
      include: { contact: true },
    });

    if (!existing) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    let contactId = existing.contactId;

    if (updateDto.contactId && updateDto.contactId !== existing.contactId) {
      const newContact = await this.prisma.contact.findUnique({ where: { id: updateDto.contactId } });
      if (!newContact) {
        throw new NotFoundException(`Contact ${updateDto.contactId} not found`);
      }
      contactId = newContact.id;
    } else if (updateDto.contact) {
      await this.prisma.contact.update({
        where: { id: existing.contactId },
        data: {
          ...updateDto.contact,
        },
      });
    }

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        contactId,
        title: updateDto.title,
        description: updateDto.description,
        status: updateDto.status,
        value:
          updateDto.value !== undefined && updateDto.value !== null
            ? new Prisma.Decimal(updateDto.value)
            : undefined,
        probability: updateDto.probability,
        assignedToId: updateDto.assignedToId,
        source: updateDto.source,
        expectedCloseDate: updateDto.expectedCloseDate
          ? new Date(updateDto.expectedCloseDate)
          : undefined,
        prospectCompanyName: updateDto.prospectCompanyName,
        prospectWebsite: updateDto.prospectWebsite,
        prospectIndustry: updateDto.prospectIndustry,
      },
    });

    return this.findOne(lead.id);
  }

  async updateStatus(id: string, statusDto: UpdateLeadStatusDto) {
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        status: statusDto.status,
        probability: statusDto.probability,
        lostReason: statusDto.lostReason,
        actualCloseDate: statusDto.actualCloseDate ? new Date(statusDto.actualCloseDate) : undefined,
      },
    });

    return this.findOne(lead.id);
  }

  async convert(id: string, convertDto: ConvertLeadDto) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { contact: true },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    if (lead.convertedCustomerId) {
      throw new BadRequestException('Lead is already converted to a customer');
    }

    return this.prisma.$transaction(async (tx) => {
      let customerId = convertDto.customerId;

      if (customerId) {
        const existingCustomer = await tx.customer.findUnique({ where: { id: customerId } });
        if (!existingCustomer) {
          throw new NotFoundException(`Customer ${customerId} not found`);
        }
      } else {
        const customer = await tx.customer.create({
          data: {
            name: convertDto.customerName,
            email: convertDto.customerEmail,
            phone: convertDto.customerPhone,
            website: convertDto.customerWebsite,
            industry: convertDto.customerIndustry,
            type: convertDto.customerType ?? CustomerType.STAFF_AUGMENTATION,
            status: convertDto.customerStatus ?? CustomerStatus.ACTIVE,
            sentiment: convertDto.customerSentiment ?? CustomerSentiment.HAPPY,
            monthlyValue:
              convertDto.customerMonthlyValue !== undefined && convertDto.customerMonthlyValue !== null
                ? new Prisma.Decimal(convertDto.customerMonthlyValue)
                : undefined,
            currency: convertDto.customerCurrency ?? 'USD',
            notes: convertDto.customerNotes,
          },
        });
        customerId = customer.id;
      }

      await tx.lead.update({
        where: { id },
        data: {
          convertedCustomerId: customerId,
          status: convertDto.leadStatus ?? LeadStatus.WON,
          actualCloseDate: new Date(),
        },
      });

      await tx.contact.update({
        where: { id: lead.contactId },
        data: {
          customerId,
          companyName: lead.contact.companyName || convertDto.customerName,
        },
      });

      return this.findOne(id);
    });
  }

  async remove(id: string) {
    await this.prisma.lead.delete({ where: { id } });
    return { deleted: true };
  }

  async listContacts(search?: string, take = 50) {
    return this.prisma.contact.findMany({
      where: search
        ? {
            OR: [
              { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { companyName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: 'desc' },
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        companyName: true,
        customerId: true,
      },
    });
  }
}
