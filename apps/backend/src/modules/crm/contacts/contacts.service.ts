import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { QueryBuilder } from '../../../common/utils/query-builder.util';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';
import { ConvertContactToLeadDto } from './dto/convert-contact-to-lead.dto';
import { ACTIVITY_SUMMARY_INCLUDE, mapActivitySummary } from '../../activities/activity.mapper';

@Injectable()
export class ContactsService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

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
    const baseWhere = QueryBuilder.buildWhereClause<Prisma.ContactWhereInput>(
      filters,
      {
        searchFields: ['firstName', 'lastName', 'email', 'phone', 'companyName'],
      },
    );

    // Handle unassigned filter (special case)
    if (filters.unassigned) {
      baseWhere.customerId = null;
    }

    return baseWhere;
  }

  async create(createContactDto: CreateContactDto) {
    return this.handlePrismaError(async () => {
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
    }, ErrorMessages.CREATE_FAILED('Contact'));
  }

  async findAll(filters: FilterContactsDto) {
    const { page = 1, pageSize = 25, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

    const where = this.buildWhere(filters);

    const orderBy: Prisma.ContactOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const result = await this.paginate(
      this.prisma.contact,
      where,
      {
        page,
        pageSize,
        orderBy,
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
      }
    );

    return {
      ...result,
      data: result.data.map((contact) => this.formatContact(contact)),
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
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Contact', id));
    }

    return this.formatContact(contact);
  }

  async update(id: string, updateContactDto: UpdateContactDto) {
    return this.handlePrismaError(async () => {
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
    }, ErrorMessages.UPDATE_FAILED('Contact'));
  }

  async remove(id: string) {
    return this.handlePrismaError(async () => {
      await this.prisma.contact.delete({ where: { id } });
      return { deleted: true };
    }, ErrorMessages.DELETE_FAILED('Contact'));
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
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Contact', id));
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
      throw new NotFoundException(ErrorMessages.CREATE_FAILED('Lead'));
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
