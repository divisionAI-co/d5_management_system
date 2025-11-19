import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';
import { ConvertContactToLeadDto } from './dto/convert-contact-to-lead.dto';
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
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  private formatContact(contact: any) {
    if (!contact) {
      return contact;
    }

    const formatted = { ...contact };
    if (formatted.customer) {
      formatted.customer = {
        id: formatted.customer.id,
        name: formatted.customer.name,
        email: formatted.customer.email,
        phone: formatted.customer.phone,
      };
    }

    // Handle leadContacts (many-to-many) - extract leads from the join table
    if (Array.isArray(formatted.leadContacts)) {
      formatted.leads = formatted.leadContacts.map((lc: any) => ({
        id: lc.lead.id,
        title: lc.lead.title,
        status: lc.lead.status,
        value: lc.lead.value ? Number(lc.lead.value) : null,
      }));
      delete formatted.leadContacts; // Remove the join table data, keep only leads array for backward compatibility
    }

    if (Array.isArray(formatted.activities)) {
      formatted.activities = formatted.activities.map((activity: any) =>
        mapActivitySummary(activity),
      );
    }

    return formatted;
  }

  private buildWhere(filters: FilterContactsDto): Prisma.ContactWhereInput {
    const where: Prisma.ContactWhereInput = {};

    if (filters.search) {
      const search = filters.search.trim();
      where.OR = [
        { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { companyName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.unassigned) {
      where.customerId = null;
    }

    return where;
  }

  async create(createContactDto: CreateContactDto) {
    try {
      const contact = await this.prisma.contact.create({
        data: {
          firstName: createContactDto.firstName,
          lastName: createContactDto.lastName,
          email: createContactDto.email,
          phone: createContactDto.phone,
          role: createContactDto.role,
          companyName: createContactDto.companyName,
          linkedinUrl: createContactDto.linkedinUrl,
          notes: createContactDto.notes,
          customerId: createContactDto.customerId,
        },
        include: {
          customer: true,
          leadContacts: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              lead: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  value: true,
                },
              },
            },
          },
        },
      });

      return this.formatContact(contact);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException('A contact with this email already exists.');
      }
      throw error;
    }
  }

  async findAll(filters: FilterContactsDto): Promise<PaginatedResult<any>> {
    const { page = 1, pageSize = 25, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
    const skip = (page - 1) * pageSize;

    const where = this.buildWhere(filters);

    const orderBy: Prisma.ContactOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [total, contacts] = await this.prisma.$transaction([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          _count: {
            select: {
              leadContacts: true,
              activities: true,
            },
          },
        },
      }),
    ]);

    return {
      data: contacts.map((contact) => this.formatContact(contact)),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({
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
        leadContacts: {
          orderBy: { createdAt: 'desc' },
          include: {
            lead: {
              select: {
                id: true,
                title: true,
                status: true,
                value: true,
                probability: true,
                createdAt: true,
              },
            },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: ACTIVITY_SUMMARY_INCLUDE,
        },
      },
    });

    if (!contact) {
      throw new NotFoundException(`Contact ${id} not found`);
    }

    return this.formatContact(contact);
  }

  async update(id: string, updateContactDto: UpdateContactDto) {
    try {
      const contact = await this.prisma.contact.update({
        where: { id },
        data: {
          firstName: updateContactDto.firstName,
          lastName: updateContactDto.lastName,
          email: updateContactDto.email,
          phone: updateContactDto.phone,
          role: updateContactDto.role,
          companyName: updateContactDto.companyName,
          linkedinUrl: updateContactDto.linkedinUrl,
          notes: updateContactDto.notes,
          customerId: updateContactDto.customerId,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          leadContacts: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              lead: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  value: true,
                },
              },
            },
          },
        },
      });

      return this.formatContact(contact);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException('A contact with this email already exists.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.contact.delete({ where: { id } });
      return { deleted: true };
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException(`Contact ${id} not found`);
      }
      throw error;
    }
  }

  async convertToLead(id: string, dto: ConvertContactToLeadDto) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
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

    if (!contact) {
      throw new NotFoundException(`Contact ${id} not found`);
    }

    const lead = await this.prisma.lead.create({
      data: {
        contactId: contact.id,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? LeadStatus.NEW,
        value:
          dto.value !== undefined && dto.value !== null
            ? new Prisma.Decimal(dto.value)
            : undefined,
        probability: dto.probability,
        assignedToId: dto.assignedToId,
        source: dto.source,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : undefined,
        prospectCompanyName: dto.prospectCompanyName ?? contact.companyName,
        prospectIndustry: dto.prospectIndustry,
        prospectWebsite: dto.prospectWebsite,
      },
    });

    const leadWithRelations = await this.prisma.lead.findUnique({
      where: { id: lead.id },
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
                customerId: true,
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
      },
    });

    if (!leadWithRelations) {
      throw new NotFoundException('Lead not found after creation');
    }

    return {
      ...leadWithRelations,
      value:
        leadWithRelations.value !== undefined && leadWithRelations.value !== null
          ? Number(leadWithRelations.value)
          : null,
    };
  }
}
