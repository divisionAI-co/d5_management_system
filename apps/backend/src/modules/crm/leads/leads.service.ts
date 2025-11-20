import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerSentiment, CustomerStatus, CustomerType, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { QueryBuilder } from '../../../common/utils/query-builder.util';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { FilterLeadsDto } from './dto/filter-leads.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { ACTIVITY_SUMMARY_INCLUDE, mapActivitySummary } from '../../activities/activity.mapper';

@Injectable()
export class LeadsService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private formatLead(lead: any) {
    if (!lead) return lead;

    const formatted = {
      ...lead,
      value: lead?.value ? Number(lead.value) : null,
    };

    // Normalize contacts: combine many-to-many contacts with legacy single contact
    if (lead.contacts && Array.isArray(lead.contacts) && lead.contacts.length > 0) {
      // Use many-to-many contacts
      formatted.contacts = lead.contacts.map((lc: any) => lc.contact);
      // For backward compatibility, also set the first contact as the primary contact
      formatted.contact = lead.contacts[0]?.contact || lead.contact;
    } else if (lead.contact) {
      // Fallback to legacy single contact
      formatted.contacts = [lead.contact];
      formatted.contact = lead.contact;
    } else {
      formatted.contacts = [];
      formatted.contact = null;
    }

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

  private async resolveContacts(createDto: CreateLeadDto): Promise<string[]> {
    // Handle multiple contactIds (new approach)
    if (createDto.contactIds && createDto.contactIds.length > 0) {
      const contacts = await this.prisma.contact.findMany({
        where: { id: { in: createDto.contactIds } },
      });
      if (contacts.length !== createDto.contactIds.length) {
        const foundIds = new Set(contacts.map(c => c.id));
        const missingIds = createDto.contactIds.filter(id => !foundIds.has(id));
        throw new NotFoundException(
          ErrorMessages.NOT_FOUND_BY_FIELD('Contacts', 'id', missingIds.join(', '))
        );
      }
      return contacts.map(c => c.id);
    }

    // Handle legacy single contactId
    if (createDto.contactId) {
      const existing = await this.prisma.contact.findUnique({ where: { id: createDto.contactId } });
      if (!existing) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND('Contact', createDto.contactId));
      }
      return [existing.id];
    }

    // Handle creating a new contact
    if (createDto.contact) {
      const existingByEmail = await this.prisma.contact.findUnique({ where: { email: createDto.contact.email } });
      if (existingByEmail) {
        return [existingByEmail.id];
      }

      const { customerId, ...contactData } = createDto.contact;
      const newContact = await this.prisma.contact.create({
        data: {
          ...contactData,
          customerId,
        },
      });

      return [newContact.id];
    }

    throw new BadRequestException('Either contactIds, contactId, or contact details must be provided');
  }

  private buildWhereClause(filters: FilterLeadsDto): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = {};

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        {
          // Search in contacts via the many-to-many relationship
          contacts: {
            some: {
              contact: {
                OR: [
                  { firstName: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
                  { lastName: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
                  { email: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
                  { companyName: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            },
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
      // Support both new many-to-many and legacy single contact
      where.OR = [
        { contacts: { some: { contactId: filters.contactId } } },
        { contactId: filters.contactId },
      ];
    }

    if (filters.convertedCustomerId) {
      where.convertedCustomerId = filters.convertedCustomerId;
    }

    return where;
  }

  async create(createLeadDto: CreateLeadDto) {
    return this.handlePrismaError(async () => {
      const contactIds = await this.resolveContacts(createLeadDto);

      // Create lead with first contactId for backward compatibility (legacy field)
      const firstContactId = contactIds[0];

      const lead = await this.prisma.lead.create({
      data: {
        contactId: firstContactId, // Legacy field for backward compatibility
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
        leadType: createLeadDto.leadType,
        // Create many-to-many relationships
        contacts: {
          create: contactIds.map(contactId => ({
            contactId,
          })),
        },
      },
    });

      return this.findOne(lead.id);
    }, ErrorMessages.CREATE_FAILED('Lead'));
  }

  async findAll(filters: FilterLeadsDto) {
    const { page = 1, pageSize = 25 } = filters;

    const where = this.buildWhereClause(filters);

    const orderBy: Prisma.LeadOrderByWithRelationInput = {
      [filters.sortBy ?? 'createdAt']: filters.sortOrder ?? 'desc',
    };

    const result = await this.paginate(
      this.prisma.lead,
      where,
      {
        page,
        pageSize,
        orderBy,
        include: {
          // New many-to-many relationship
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
          convertedCustomer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }
    );

    return {
      ...result,
      data: result.data.map((lead) => this.formatLead(lead)),
    };
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        // New many-to-many relationship
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
      include: { 
        contacts: {
          include: { contact: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Lead', id));
    }

    // Handle contact updates
    let contactIds: string[] | undefined;
    let firstContactId = existing.contactId;

    // Handle new contactIds array (multiple contacts)
    if (updateDto.contactIds) {
      const contacts = await this.prisma.contact.findMany({
        where: { id: { in: updateDto.contactIds } },
      });
      if (contacts.length !== updateDto.contactIds.length) {
        const foundIds = new Set(contacts.map(c => c.id));
        const missingIds = updateDto.contactIds.filter(id => !foundIds.has(id));
        throw new NotFoundException(
          ErrorMessages.NOT_FOUND_BY_FIELD('Contacts', 'id', missingIds.join(', '))
        );
      }
      contactIds = contacts.map(c => c.id);
      firstContactId = contactIds[0];
    } 
    // Handle legacy single contactId
    else if (updateDto.contactId) {
      const newContact = await this.prisma.contact.findUnique({ where: { id: updateDto.contactId } });
      if (!newContact) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND('Contact', updateDto.contactId));
      }
      firstContactId = newContact.id;
      contactIds = [newContact.id];
    }
    // Handle contact update (updating existing contact details)
    else if (updateDto.contact && existing.contactId) {
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
        contactId: firstContactId, // Legacy field for backward compatibility
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
        leadType: updateDto.leadType,
        // Update many-to-many relationships if contactIds provided
        ...(contactIds && {
          contacts: {
            deleteMany: {}, // Remove all existing
            create: contactIds.map(contactId => ({ contactId })),
          },
        }),
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
      include: { 
        contacts: {
          include: { contact: true },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Lead', id));
    }

    if (lead.convertedCustomerId) {
      throw new BadRequestException(
        ErrorMessages.OPERATION_NOT_ALLOWED('convert', 'Lead is already converted to a customer')
      );
    }

    // Get the first contact for customer link (or use contactId if contacts array is empty)
    const firstContact = lead.contacts && lead.contacts.length > 0 
      ? lead.contacts[0].contact
      : lead.contactId 
        ? await this.prisma.contact.findUnique({ where: { id: lead.contactId } })
        : null;

    if (!firstContact && !lead.contactId) {
      throw new BadRequestException('Lead has no contacts to convert');
    }

    return this.prisma.$transaction(async (tx) => {
      let customerId = convertDto.customerId;

      if (customerId) {
        const existingCustomer = await tx.customer.findUnique({ where: { id: customerId } });
        if (!existingCustomer) {
          throw new NotFoundException(ErrorMessages.NOT_FOUND('Customer', customerId));
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

      // Update all contacts linked to this lead to associate with the customer
      const contactIds = lead.contacts.map(lc => lc.contactId);
      if (lead.contactId && !contactIds.includes(lead.contactId)) {
        contactIds.push(lead.contactId);
      }

      if (contactIds.length > 0) {
        await tx.contact.updateMany({
          where: { id: { in: contactIds } },
          data: {
            customerId,
            ...(convertDto.customerName && {
              companyName: firstContact?.companyName || convertDto.customerName,
            }),
          },
        });
      }

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
