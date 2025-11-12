import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiEntityType, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface FieldMetadata {
  key: string;
  label: string;
  description?: string;
}

type FieldSelector<T> = {
  key: string;
  label: string;
  description?: string;
  select: (entity: T) => unknown;
};

type CandidateSnapshot = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  currentTitle?: string | null;
  yearsOfExperience?: number | null;
  skills?: string[] | null;
  resume?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  stage: string;
  rating?: number | null;
  notes?: string | null;
};

type OpportunitySnapshot = {
  title: string;
  description?: string | null;
  stage: string;
  type: string;
  value?: Prisma.Decimal | null;
  customer?: {
    name: string | null;
    industry: string | null;
  } | null;
  lead?: {
    title: string | null;
    description: string | null;
    contact: {
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    } | null;
  } | null;
};

type EntitySnapshot = CandidateSnapshot | OpportunitySnapshot;

@Injectable()
export class EntityFieldResolver {
  private readonly candidateFields: FieldSelector<CandidateSnapshot>[] = [
    {
      key: 'fullName',
      label: 'Full name',
      description: 'Candidate full name',
      select: (candidate) => `${candidate.firstName} ${candidate.lastName}`.trim(),
    },
    {
      key: 'email',
      label: 'Email',
      select: (candidate) => candidate.email,
    },
    {
      key: 'phone',
      label: 'Phone',
      select: (candidate) => candidate.phone,
    },
    {
      key: 'currentTitle',
      label: 'Current title',
      select: (candidate) => candidate.currentTitle,
    },
    {
      key: 'yearsOfExperience',
      label: 'Years of experience',
      select: (candidate) => candidate.yearsOfExperience,
    },
    {
      key: 'skills',
      label: 'Skills',
      description: 'Comma separated skills the candidate listed',
      select: (candidate) => candidate.skills?.join(', '),
    },
    {
      key: 'resumeUrl',
      label: 'Resume URL',
      select: (candidate) => candidate.resume,
    },
    {
      key: 'linkedinUrl',
      label: 'LinkedIn URL',
      select: (candidate) => candidate.linkedinUrl,
    },
    {
      key: 'githubUrl',
      label: 'GitHub URL',
      select: (candidate) => candidate.githubUrl,
    },
    {
      key: 'portfolioUrl',
      label: 'Portfolio URL',
      select: (candidate) => candidate.portfolioUrl,
    },
    {
      key: 'stage',
      label: 'Pipeline stage',
      select: (candidate) => candidate.stage,
    },
    {
      key: 'rating',
      label: 'Internal rating',
      select: (candidate) => candidate.rating,
    },
    {
      key: 'notes',
      label: 'Recruitment notes',
      description: 'Internal notes captured by recruiters',
      select: (candidate) => candidate.notes,
    },
  ];

  private readonly opportunityFields: FieldSelector<OpportunitySnapshot>[] = [
    {
      key: 'title',
      label: 'Opportunity title',
      select: (opportunity) => opportunity.title,
    },
    {
      key: 'description',
      label: 'Opportunity description',
      select: (opportunity) => opportunity.description,
    },
    {
      key: 'stage',
      label: 'Stage',
      select: (opportunity) => opportunity.stage,
    },
    {
      key: 'type',
      label: 'Type',
      select: (opportunity) => opportunity.type,
    },
    {
      key: 'value',
      label: 'Value',
      description: 'Numeric value formatted as string',
      select: (opportunity) => (opportunity.value ? opportunity.value.toString() : null),
    },
    {
      key: 'customerName',
      label: 'Customer name',
      select: (opportunity) => opportunity.customer?.name,
    },
    {
      key: 'customerIndustry',
      label: 'Customer industry',
      select: (opportunity) => opportunity.customer?.industry,
    },
    {
      key: 'leadTitle',
      label: 'Lead title',
      select: (opportunity) => opportunity.lead?.title,
    },
    {
      key: 'leadSummary',
      label: 'Lead summary',
      select: (opportunity) => opportunity.lead?.description,
    },
    {
      key: 'leadContactName',
      label: 'Lead contact name',
      select: (opportunity) => {
        const contact = opportunity.lead?.contact;
        if (!contact) return null;
        return `${contact.firstName} ${contact.lastName}`.trim();
      },
    },
    {
      key: 'leadContactEmail',
      label: 'Lead contact email',
      select: (opportunity) => opportunity.lead?.contact?.email,
    },
    {
      key: 'leadContactPhone',
      label: 'Lead contact phone',
      select: (opportunity) => opportunity.lead?.contact?.phone,
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  listFields(entityType: AiEntityType): FieldMetadata[] {
    const definitions = this.getFieldDefinitions(entityType);
    return definitions.map(({ key, label, description }) => ({ key, label, description }));
  }

  ensureFieldKeysSupported(entityType: AiEntityType, keys: string[]) {
    if (!keys || keys.length === 0) {
      throw new BadRequestException('At least one field must be selected');
    }

    const supportedKeys = new Set(
      this.getFieldDefinitions(entityType).map((definition) => definition.key),
    );
    const unsupported = keys.filter((key) => !supportedKeys.has(key));
    if (unsupported.length > 0) {
      throw new BadRequestException(
        `Unsupported field(s) for ${entityType.toLowerCase()} entity: ${unsupported.join(', ')}`,
      );
    }
  }

  async ensureEntityExists(entityType: AiEntityType, entityId: string) {
    switch (entityType) {
      case AiEntityType.CANDIDATE: {
        const entity = await this.findCandidate(entityId);
        if (!entity) {
          throw new NotFoundException(`CANDIDATE with ID ${entityId} was not found`);
        }
        return;
      }
      case AiEntityType.OPPORTUNITY: {
        const entity = await this.findOpportunity(entityId);
        if (!entity) {
          throw new NotFoundException(`OPPORTUNITY with ID ${entityId} was not found`);
        }
        return;
      }
      default:
        throw new BadRequestException(`Entity type ${entityType} is not supported yet`);
    }
  }

  async resolveFields(entityType: AiEntityType, entityId: string, fieldKeys: string[]) {
    switch (entityType) {
      case AiEntityType.CANDIDATE: {
        const entity = await this.findCandidate(entityId);
        if (!entity) {
          throw new NotFoundException(`CANDIDATE with ID ${entityId} was not found`);
        }
        return this.mapFieldValues(fieldKeys, entity, this.candidateFields);
      }
      case AiEntityType.OPPORTUNITY: {
        const entity = await this.findOpportunity(entityId);
        if (!entity) {
          throw new NotFoundException(`OPPORTUNITY with ID ${entityId} was not found`);
        }
        return this.mapFieldValues(fieldKeys, entity, this.opportunityFields);
      }
      default:
        throw new BadRequestException(`Entity type ${entityType} is not supported yet`);
    }
  }

  private getFieldDefinitions(entityType: AiEntityType): FieldSelector<EntitySnapshot>[] {
    switch (entityType) {
      case AiEntityType.CANDIDATE:
        return this.candidateFields as FieldSelector<EntitySnapshot>[];
      case AiEntityType.OPPORTUNITY:
        return this.opportunityFields as FieldSelector<EntitySnapshot>[];
      default:
        return [];
    }
  }

  private async findCandidate(entityId: string): Promise<CandidateSnapshot | null> {
    const record = await this.prisma.candidate.findUnique({
      where: { id: entityId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        currentTitle: true,
        yearsOfExperience: true,
        skills: true,
        resume: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
        stage: true,
        rating: true,
        notes: true,
      },
    });
    if (!record) {
      return null;
    }
    return record;
  }

  private async findOpportunity(entityId: string): Promise<OpportunitySnapshot | null> {
    const record = await this.prisma.opportunity.findUnique({
      where: { id: entityId },
      select: {
        title: true,
        description: true,
        stage: true,
        type: true,
        value: true,
        customer: { select: { name: true, industry: true } },
        lead: {
          select: {
            title: true,
            description: true,
            contact: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
    if (!record) {
      return null;
    }
    return record;
  }

  private mapFieldValues<T extends EntitySnapshot>(
    fieldKeys: string[],
    entity: T,
    selectors: FieldSelector<T>[],
  ) {
    const definitionMap = new Map(selectors.map((definition) => [definition.key, definition]));
    const result: Record<string, unknown> = {};

    fieldKeys.forEach((key) => {
      const definition = definitionMap.get(key);
      if (!definition) {
        return;
      }
      const value = definition.select(entity);
      result[key] = value === undefined ? null : value;
    });

    return result;
  }
}

