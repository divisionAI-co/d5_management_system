import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AiCollectionFormat,
  AiCollectionKey,
  AiEntityType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

interface CollectionFieldSelector<T> {
  key: string;
  label: string;
  description?: string;
  select: (row: T) => unknown;
}

export interface CollectionDefinition<T> {
  key: AiCollectionKey;
  label: string;
  description?: string;
  defaultLimit: number;
  defaultFormat: AiCollectionFormat;
  fields: CollectionFieldSelector<T>[];
  resolve: (params: { entityId: string; limit: number }) => Promise<T[]>;
  format?: AiCollectionFormat[];
}

export interface CollectionSummary {
  collectionKey: AiCollectionKey;
  label: string;
  description?: string;
  defaultLimit: number;
  defaultFormat: AiCollectionFormat;
  supportedFormats: AiCollectionFormat[];
}

export interface CollectionFieldMetadata {
  key: string;
  label: string;
  description?: string;
}

type CollectionMap<T> = Partial<Record<AiCollectionKey, CollectionDefinition<T>>>;

type CandidateOpportunityPayload = Prisma.CandidatePositionGetPayload<{
  include: {
    position: {
      include: {
        opportunity: {
          select: {
            id: true;
            title: true;
            stage: true;
            type: true;
            value: true;
            updatedAt: true;
          };
        };
      };
    };
  };
}>;

type OpportunityPayload = Prisma.OpportunityGetPayload<{
  select: {
    id: true;
    title: true;
    stage: true;
    type: true;
    value: true;
    updatedAt: true;
  };
}>;

type LeadPayload = Prisma.LeadGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    expectedCloseDate: true;
    source: true;
    createdAt: true;
  };
}>;

type ActivityPayload = Prisma.ActivityGetPayload<{
  select: {
    id: true;
    subject: true;
    createdAt: true;
    activityType: {
      select: { name: true };
    };
    body: true;
  };
}>;

type TaskPayload = Prisma.TaskGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    priority: true;
    dueDate: true;
    createdAt: true;
  };
}>;

type EodReportPayload = Prisma.EodReportGetPayload<{
  select: {
    id: true;
    date: true;
    summary: true;
    hoursWorked: true;
    isLate: true;
    submittedAt: true;
  };
}>;

@Injectable()
export class CollectionFieldResolver {
  constructor(private readonly prisma: PrismaService) {}

  private readonly definitions: Partial<Record<AiEntityType, CollectionMap<any>>> = {
    EMPLOYEE: {
      [AiCollectionKey.EOD_REPORTS]: {
        key: AiCollectionKey.EOD_REPORTS,
        label: 'EOD Reports',
        description: 'Recent end-of-day reports submitted by this employee.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        fields: [
          { key: 'date', label: 'Date', description: 'Report date', select: (report: EodReportPayload) => report.date },
          {
            key: 'summary',
            label: 'Summary',
            description: 'Daily summary of accomplishments',
            select: (report: EodReportPayload) => report.summary,
          },
          {
            key: 'hoursWorked',
            label: 'Hours Worked',
            description: 'Reported hours worked',
            select: (report: EodReportPayload) => report.hoursWorked ? report.hoursWorked.toNumber?.() ?? report.hoursWorked : null,
          },
          {
            key: 'isLate',
            label: 'Late Submission',
            description: 'Whether the report was submitted late',
            select: (report: EodReportPayload) => (report.isLate ? 'Yes' : 'No'),
          },
          {
            key: 'submittedAt',
            label: 'Submitted At',
            description: 'Timestamp when the report was submitted',
            select: (report: EodReportPayload) => report.submittedAt,
          },
        ],
        resolve: async ({ entityId, limit }) => {
          const employee = await this.prisma.employee.findUnique({
            where: { id: entityId },
            select: { userId: true },
          });

          if (!employee?.userId) {
            return [];
          }

          return this.prisma.eodReport.findMany({
            where: { userId: employee.userId },
            orderBy: { date: 'desc' },
            take: limit,
            select: {
              id: true,
              date: true,
              summary: true,
              hoursWorked: true,
              isLate: true,
              submittedAt: true,
            },
          });
        },
      },
      [AiCollectionKey.TASKS]: {
        key: AiCollectionKey.TASKS,
        label: 'Assigned Tasks',
        description: 'Current tasks assigned to this employee.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        fields: [
          { key: 'title', label: 'Title', select: (task: TaskPayload) => task.title },
          { key: 'status', label: 'Status', select: (task: TaskPayload) => task.status },
          { key: 'priority', label: 'Priority', select: (task: TaskPayload) => task.priority },
          { key: 'dueDate', label: 'Due Date', select: (task: TaskPayload) => task.dueDate },
          { key: 'createdAt', label: 'Created', select: (task: TaskPayload) => task.createdAt },
        ],
        resolve: async ({ entityId, limit }) => {
          const employee = await this.prisma.employee.findUnique({
            where: { id: entityId },
            select: { userId: true },
          });
          if (!employee?.userId) {
            return [];
          }
          return this.prisma.task.findMany({
            where: { assignedToId: employee.userId },
            orderBy: { dueDate: 'asc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              createdAt: true,
            },
          });
        },
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Most recent activities related to this employee.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        fields: [
          { key: 'subject', label: 'Subject', select: (activity: ActivityPayload) => activity.subject },
          {
            key: 'type',
            label: 'Type',
            select: (activity: ActivityPayload) => activity.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (activity: ActivityPayload) => activity.createdAt },
          { key: 'body', label: 'Details', select: (activity: ActivityPayload) => activity.body },
        ],
        resolve: async ({ entityId, limit }) =>
          this.prisma.activity.findMany({
            where: { employeeId: entityId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          }),
      },
    },
    CUSTOMER: {
      [AiCollectionKey.OPPORTUNITIES]: {
        key: AiCollectionKey.OPPORTUNITIES,
        label: 'Opportunities',
        description: 'Opportunities linked to this customer.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        fields: [
          { key: 'title', label: 'Title', select: (row: OpportunityPayload) => row.title },
          { key: 'stage', label: 'Stage', select: (row: OpportunityPayload) => row.stage },
          { key: 'type', label: 'Type', select: (row: OpportunityPayload) => row.type },
          {
            key: 'value',
            label: 'Value',
            select: (row: OpportunityPayload) => row.value ? row.value.toNumber?.() ?? row.value : null,
          },
          { key: 'updatedAt', label: 'Updated', select: (row: OpportunityPayload) => row.updatedAt },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.opportunity.findMany({
            where: { customerId: entityId },
            orderBy: { updatedAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              stage: true,
              type: true,
              value: true,
              updatedAt: true,
            },
          }),
      },
      [AiCollectionKey.LEADS]: {
        key: AiCollectionKey.LEADS,
        label: 'Related Leads',
        description: 'Leads converted into this customer.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        fields: [
          { key: 'title', label: 'Title', select: (row: LeadPayload) => row.title },
          { key: 'status', label: 'Status', select: (row: LeadPayload) => row.status },
          {
            key: 'expectedCloseDate',
            label: 'Expected Close',
            select: (row: LeadPayload) => row.expectedCloseDate,
          },
          { key: 'source', label: 'Source', select: (row: LeadPayload) => row.source },
          { key: 'createdAt', label: 'Created', select: (row: LeadPayload) => row.createdAt },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.lead.findMany({
            where: { convertedCustomerId: entityId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              expectedCloseDate: true,
              source: true,
              createdAt: true,
            },
          }),
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities involving this customer.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.activity.findMany({
            where: { customerId: entityId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          }),
      },
      [AiCollectionKey.TASKS]: {
        key: AiCollectionKey.TASKS,
        label: 'Customer Tasks',
        description: 'Tasks associated with this customer.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        fields: [
          { key: 'title', label: 'Title', select: (row: TaskPayload) => row.title },
          { key: 'status', label: 'Status', select: (row: TaskPayload) => row.status },
          { key: 'priority', label: 'Priority', select: (row: TaskPayload) => row.priority },
          { key: 'dueDate', label: 'Due Date', select: (row: TaskPayload) => row.dueDate },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.task.findMany({
            where: { customerId: entityId },
            orderBy: { dueDate: 'asc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              createdAt: true,
            },
          }),
      },
    },
    LEAD: {
      [AiCollectionKey.OPPORTUNITIES]: {
        key: AiCollectionKey.OPPORTUNITIES,
        label: 'Opportunities',
        description: 'Opportunities created from this lead.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        fields: [
          { key: 'title', label: 'Title', select: (row: OpportunityPayload) => row.title },
          { key: 'stage', label: 'Stage', select: (row: OpportunityPayload) => row.stage },
          {
            key: 'value',
            label: 'Value',
            select: (row: OpportunityPayload) => row.value ? row.value.toNumber?.() ?? row.value : null,
          },
          { key: 'updatedAt', label: 'Updated', select: (row: OpportunityPayload) => row.updatedAt },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.opportunity.findMany({
            where: { leadId: entityId },
            orderBy: { updatedAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              stage: true,
              type: true,
              value: true,
              updatedAt: true,
            },
          }),
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities for this lead.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.activity.findMany({
            where: { leadId: entityId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          }),
      },
    },
    OPPORTUNITY: {
      [AiCollectionKey.LEADS]: {
        key: AiCollectionKey.LEADS,
        label: 'Lead History',
        description: 'Lead records connected to this opportunity.',
        defaultLimit: 3,
        defaultFormat: AiCollectionFormat.TABLE,
        fields: [
          { key: 'title', label: 'Title', select: (row: LeadPayload) => row.title },
          { key: 'status', label: 'Status', select: (row: LeadPayload) => row.status },
          { key: 'createdAt', label: 'Created', select: (row: LeadPayload) => row.createdAt },
        ],
        resolve: async ({ entityId, limit }) => {
          const opportunity = await this.prisma.opportunity.findUnique({
            where: { id: entityId },
            select: { leadId: true },
          });
          if (!opportunity?.leadId) {
            return [];
          }
          const lead = await this.prisma.lead.findUnique({
            where: { id: opportunity.leadId },
            select: {
              id: true,
              title: true,
              status: true,
              expectedCloseDate: true,
              source: true,
              createdAt: true,
            },
          });
          return lead ? [lead] : [];
        },
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities for this opportunity.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.activity.findMany({
            where: { opportunityId: entityId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          }),
      },
    },
    CANDIDATE: {
      [AiCollectionKey.OPPORTUNITIES]: {
        key: AiCollectionKey.OPPORTUNITIES,
        label: 'Related Opportunities',
        description: 'Opportunities linked via candidate positions.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        fields: [
          { key: 'title', label: 'Title', select: (row: OpportunityPayload) => row.title },
          { key: 'stage', label: 'Stage', select: (row: OpportunityPayload) => row.stage },
          { key: 'type', label: 'Type', select: (row: OpportunityPayload) => row.type },
          {
            key: 'value',
            label: 'Value',
            select: (row: OpportunityPayload) => row.value ? row.value.toNumber?.() ?? row.value : null,
          },
        ],
        resolve: async ({ entityId, limit }) => {
          const positions: CandidateOpportunityPayload[] = await this.prisma.candidatePosition.findMany({
            where: { candidateId: entityId },
            take: limit,
            include: {
              position: {
                include: {
                  opportunity: {
                    select: {
                      id: true,
                      title: true,
                      stage: true,
                      type: true,
                      value: true,
                      updatedAt: true,
                    },
                  },
                },
              },
            },
          });

          return positions
            .map((position) => position.position?.opportunity)
            .filter((opportunity): opportunity is OpportunityPayload => Boolean(opportunity));
        },
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities logged for this candidate.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.activity.findMany({
            where: { candidateId: entityId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          }),
      },
    },
    CONTACT: {
      [AiCollectionKey.LEADS]: {
        key: AiCollectionKey.LEADS,
        label: 'Leads',
        description: 'Leads associated with this contact.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        fields: [
          { key: 'title', label: 'Title', select: (row: LeadPayload) => row.title },
          { key: 'status', label: 'Status', select: (row: LeadPayload) => row.status },
          { key: 'createdAt', label: 'Created', select: (row: LeadPayload) => row.createdAt },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.lead.findMany({
            where: { contactId: entityId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              expectedCloseDate: true,
              source: true,
              createdAt: true,
            },
          }),
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities for this contact.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.activity.findMany({
            where: { contactId: entityId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          }),
      },
    },
    TASK: {
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities related to this task.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: ({ entityId, limit }) =>
          this.prisma.activity.findMany({
            where: { taskId: entityId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          }),
      },
    },
  };

  listCollections(entityType: AiEntityType): CollectionSummary[] {
    const definitions = this.definitions[entityType];
    if (!definitions) {
      return [];
    }

    return Object.values(definitions)
      .filter((definition): definition is CollectionDefinition<any> => definition !== undefined)
      .map((definition) => ({
        collectionKey: definition.key,
        label: definition.label,
        description: definition.description,
        defaultLimit: definition.defaultLimit,
        defaultFormat: definition.defaultFormat,
        supportedFormats: definition.format ?? [
          definition.defaultFormat,
          ...Object.values(AiCollectionFormat).filter((format) => format !== definition.defaultFormat),
        ],
      }));
  }

  listCollectionFields(entityType: AiEntityType, collectionKey: AiCollectionKey): CollectionFieldMetadata[] {
    const definition = this.getCollectionDefinition(entityType, collectionKey);
    if (!definition) {
      return [];
    }

    return definition.fields.map((field) => ({
      key: field.key,
      label: field.label,
      description: field.description,
    }));
  }

  ensureCollectionSupported(entityType: AiEntityType, collectionKey: AiCollectionKey) {
    const definition = this.getCollectionDefinition(entityType, collectionKey);
    if (!definition) {
      throw new BadRequestException(`Collection ${collectionKey} is not supported for ${entityType}`);
    }
  }

  ensureCollectionFieldsSupported(
    entityType: AiEntityType,
    collectionKey: AiCollectionKey,
    fieldKeys: string[],
  ) {
    const definition = this.getCollectionDefinition(entityType, collectionKey);
    if (!definition) {
      throw new BadRequestException(`Collection ${collectionKey} is not supported for ${entityType}`);
    }

    const supportedKeys = new Set(definition.fields.map((field) => field.key));
    const unsupported = fieldKeys.filter((key) => !supportedKeys.has(key));
    if (unsupported.length > 0) {
      throw new BadRequestException(
        `Unsupported fields for ${collectionKey}: ${unsupported.join(', ')}`,
      );
    }
  }

  getCollectionDefinition(entityType: AiEntityType, collectionKey: AiCollectionKey) {
    const definitions = this.definitions[entityType];
    return definitions ? definitions[collectionKey] ?? null : null;
  }

  async resolveCollection(params: {
    entityType: AiEntityType;
    entityId: string;
    collectionKey: AiCollectionKey;
    limit?: number;
    fieldKeys: string[];
  }): Promise<Array<Record<string, unknown>>> {
    const definition = this.getCollectionDefinition(params.entityType, params.collectionKey);
    if (!definition) {
      return [];
    }

    const rows = await definition.resolve({
      entityId: params.entityId,
      limit: params.limit ?? definition.defaultLimit,
    });

    const fieldSelectors = definition.fields.filter((field) => params.fieldKeys.includes(field.key));

    return rows.map((row) => {
      const payload: Record<string, unknown> = {};
      for (const selector of fieldSelectors) {
        payload[selector.key] = selector.select(row);
      }
      return payload;
    });
  }
}


