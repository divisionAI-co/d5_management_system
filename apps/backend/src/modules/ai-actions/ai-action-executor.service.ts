import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ActivityVisibility, Prisma } from '@prisma/client';

type AiEntityType = 'CUSTOMER' | 'LEAD' | 'OPPORTUNITY' | 'CANDIDATE' | 'EMPLOYEE' | 'CONTACT' | 'TASK';
type AiCollectionKey = 'EOD_REPORTS' | 'OPPORTUNITIES' | 'LEADS' | 'TASKS' | 'ACTIVITIES';
type AiCollectionFormat = 'TABLE' | 'BULLET_LIST' | 'PLAIN_TEXT';
type AiActionExecutionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { CreateActivityDto } from '../activities/dto/create-activity.dto';
import { GeminiService } from './gemini.service';
import { EntityFieldResolver } from './entity-field-resolver.service';
import { CollectionFieldResolver } from './collection-field-resolver.service';

interface ExecuteSavedActionOptions {
  actionId: string;
  entityId: string;
  fieldKeysOverride?: string[];
  promptOverride?: string;
  extraInstructions?: string;
  triggeredById: string;
}

interface ExecuteAdhocOptions {
  entityType: AiEntityType;
  entityId: string;
  fieldKeys: string[];
  prompt: string;
  extraInstructions?: string;
  triggeredById: string;
  model?: string;
}

@Injectable()
export class AiActionExecutor {
  private activityTypeId?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: ActivitiesService,
    private readonly geminiService: GeminiService,
    private readonly entityFieldResolver: EntityFieldResolver,
    private readonly collectionResolver: CollectionFieldResolver,
  ) {}

  async executeSavedAction(options: ExecuteSavedActionOptions) {
    const prisma = this.prisma as any;

    const action = await prisma.aiAction.findUnique({
      where: { id: options.actionId },
      include: {
        fields: { orderBy: { order: 'asc' } },
        collections: { orderBy: { order: 'asc' }, include: { fields: { orderBy: { order: 'asc' } } } },
      },
    });

    if (!action) {
      throw new NotFoundException('Gemini action not found');
    }
    if (!action.isActive) {
      throw new BadRequestException('Gemini action is inactive');
    }

    const fieldKeys =
      options.fieldKeysOverride && options.fieldKeysOverride.length > 0
        ? options.fieldKeysOverride
        : (action.fields as Array<{ fieldKey: string }>).map((field) => field.fieldKey);

    this.entityFieldResolver.ensureFieldKeysSupported(action.entityType, fieldKeys);

    const fieldValues = await this.entityFieldResolver.resolveFields(
      action.entityType,
      options.entityId,
      fieldKeys,
    );

    const collectionsData = await this.buildCollectionContext({
      actionEntityType: action.entityType,
      entityId: options.entityId,
      collections: action.collections ?? [],
    });

    const promptTemplate = options.promptOverride ?? action.promptTemplate;
    const placeholderMap: Record<string, string> = {};
    for (const context of collectionsData.contexts) {
      const placeholderPattern = new RegExp(`\\{\\{\\s*${context.placeholder}\\s*\\}\\}`, 'i');
      context.placeholderUsed = placeholderPattern.test(promptTemplate);
      if (context.placeholderUsed) {
        placeholderMap[context.placeholder] = context.textBlock;
      }
    }

    const promptContext = { ...fieldValues, ...placeholderMap };
    let prompt = this.interpolatePrompt(promptTemplate, promptContext, options.extraInstructions);

    for (const context of collectionsData.contexts) {
      if (!context.placeholderUsed) {
        prompt = `${prompt.trim()}\n\n${context.textBlock}`;
      }
    }

    const attachment = await prisma.aiActionAttachment.findFirst({
      where: {
        actionId: action.id,
        entityType: action.entityType,
        entityId: options.entityId,
      },
      select: { id: true },
    });

    return this.executeWithGemini({
      actionId: action.id,
      attachmentId: attachment?.id,
      entityType: action.entityType,
      entityId: options.entityId,
      model: action.model ?? undefined,
      fieldValues: promptContext,
      collectionContext: collectionsData.debugContext,
      prompt,
      actionName: action.name,
      triggeredById: options.triggeredById,
    });
  }

  async executeAdhoc(options: ExecuteAdhocOptions) {
    this.entityFieldResolver.ensureFieldKeysSupported(options.entityType, options.fieldKeys);
    const fieldValues = await this.entityFieldResolver.resolveFields(
      options.entityType,
      options.entityId,
      options.fieldKeys,
    );

    const prompt = this.interpolatePrompt(options.prompt, fieldValues, options.extraInstructions);

    return this.executeWithGemini({
      entityType: options.entityType,
      entityId: options.entityId,
      model: options.model,
      fieldValues,
      prompt,
      actionName: 'Ad-hoc Gemini prompt',
      triggeredById: options.triggeredById,
    });
  }

  private async executeWithGemini(params: {
    actionId?: string;
    attachmentId?: string;
    entityType: AiEntityType;
    entityId: string;
    model?: string;
    fieldValues: Record<string, unknown>;
    prompt: string;
    actionName: string;
    triggeredById: string;
    collectionContext?: Record<string, { rows: Array<Record<string, unknown>>; formatted: string }>;
  }) {
    const prisma = this.prisma as any;

    const normalizedInputs = JSON.parse(
      JSON.stringify(params.fieldValues ?? {}),
    ) as Record<string, unknown>;
    if (params.collectionContext) {
      normalizedInputs.__collections = JSON.parse(JSON.stringify(params.collectionContext));
    }

    const execution = await prisma.aiActionExecution.create({
      data: {
        actionId: params.actionId,
        attachmentId: params.attachmentId,
        entityType: params.entityType,
        entityId: params.entityId,
        prompt: params.prompt,
        inputs: normalizedInputs as Prisma.InputJsonValue,
        status: 'PENDING' as AiActionExecutionStatus,
        triggeredById: params.triggeredById,
      },
    });

    try {
      const result = await this.geminiService.generateText({
        prompt: params.prompt,
        model: params.model,
      });

      const activity = await this.createActivityForExecution({
        executionId: execution.id,
        entityType: params.entityType,
        entityId: params.entityId,
        triggeredById: params.triggeredById,
        actionName: params.actionName,
        outputText: result.text,
        fieldValues: params.fieldValues,
        collections: params.collectionContext,
      });

      const updated = await prisma.aiActionExecution.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCESS' as AiActionExecutionStatus,
          output: { text: result.text } as Prisma.InputJsonValue,
          rawOutput: this.safeStringify(result.rawResponse),
          completedAt: new Date(),
          activityId: activity.id,
        },
        include: {
          action: true,
          activity: true,
        },
      });

      return updated;
    } catch (error) {
      await prisma.aiActionExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED' as AiActionExecutionStatus,
          errorMessage: (error as Error).message ?? 'Gemini execution failed',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private interpolatePrompt(
    template: string,
    context: Record<string, unknown>,
    extraInstructions?: string,
  ) {
    let result = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
      const value = context[key];
      return value === undefined || value === null ? '' : this.stringifyValue(value);
    });

    if (extraInstructions && extraInstructions.trim().length > 0) {
      result = `${result.trim()}\n\nAdditional instructions:\n${extraInstructions.trim()}`;
    }

    return result;
  }

  private stringifyValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.stringifyValue(item)).join(', ');
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  private safeStringify(value: unknown): string | null {
    try {
      if (value === undefined) {
        return null;
      }
      if (typeof value === 'string') {
        return value;
      }
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  private async createActivityForExecution(params: {
    executionId: string;
    entityType: AiEntityType;
    entityId: string;
    triggeredById: string;
    actionName: string;
    outputText: string;
    fieldValues: Record<string, unknown>;
    collections?: Record<string, { rows: Array<Record<string, unknown>>; formatted: string }>;
  }) {
    const activityTypeId = await this.getActivityTypeId();

    const targets = this.buildActivityTargets(params.entityType, params.entityId);

    const metadata = {
      aiActionExecutionId: params.executionId,
      entityType: params.entityType,
      entityId: params.entityId,
      fieldKeys: Object.keys(params.fieldValues),
      context: params.fieldValues,
      collections: params.collections ? JSON.parse(JSON.stringify(params.collections)) : undefined,
    };

    const bodyLines = [
      `Gemini response generated at ${new Date().toISOString()}:`,
      '',
      params.outputText.trim(),
    ];

    const activityDto: CreateActivityDto = {
      activityTypeId,
      subject: `Gemini • ${params.actionName}`,
      body: bodyLines.join('\n'),
      metadata,
      targets,
      visibility: ActivityVisibility.PUBLIC,
    };

    const activity = await this.activitiesService.create(activityDto, params.triggeredById);

    return activity;
  }

  private async buildCollectionContext(params: {
    actionEntityType: AiEntityType;
    entityId: string;
    collections: Array<{
      collectionKey: AiCollectionKey;
      format: AiCollectionFormat;
      limit?: number | null;
      metadata?: Prisma.JsonValue | null;
      fields: Array<{ fieldKey: string; fieldLabel: string; metadata?: Prisma.JsonValue | null }>;
      order: number;
    }>;
  }) {
    const contexts: Array<{
      placeholder: string;
      textBlock: string;
      placeholderUsed: boolean;
    }> = [];
    const debugContext: Record<
      string,
      {
        rows: Array<Record<string, unknown>>;
        formatted: string;
      }
    > = {};

    if (!params.collections || params.collections.length === 0) {
      return { contexts, debugContext };
    }

    for (const collection of params.collections) {
      const fieldKeys =
        collection.fields?.map((field: { fieldKey: string }) => field.fieldKey) ?? [];
      if (fieldKeys.length === 0) {
        continue;
      }

      const definition = this.collectionResolver.getCollectionDefinition(
        params.actionEntityType,
        collection.collectionKey,
      );
      if (!definition) {
        continue;
      }

      const rows = await this.collectionResolver.resolveCollection({
        entityType: params.actionEntityType,
        entityId: params.entityId,
        collectionKey: collection.collectionKey,
        limit: collection.limit ?? definition.defaultLimit,
        fieldKeys,
      });

      const formatted = this.formatCollection({
        collectionKey: collection.collectionKey,
        format: collection.format,
        definitionLabel: definition.label,
        rows,
        fields: collection.fields.map((field: { fieldKey: string; fieldLabel: string }) => ({
          fieldKey: field.fieldKey,
          fieldLabel: field.fieldLabel,
        })),
      });

      const placeholder = collection.collectionKey;
      contexts.push({
        placeholder,
        textBlock: formatted.textBlock,
        placeholderUsed: false,
      });
      debugContext[placeholder] = {
        rows,
        formatted: formatted.textBlock,
      };
    }

    return { contexts, debugContext };
  }

  private formatCollection(params: {
    collectionKey: AiCollectionKey;
    format: AiCollectionFormat;
    definitionLabel: string;
    rows: Array<Record<string, unknown>>;
    fields: Array<{ fieldKey: string; fieldLabel: string }>;
  }) {
    const heading = `### ${params.definitionLabel}`;

    if (!params.rows || params.rows.length === 0) {
      const textBlock = `${heading}\n_No data available._`;
      return { textBlock };
    }

    const fieldHeaders = params.fields.map((field) => ({
      key: field.fieldKey,
      label: field.fieldLabel,
    }));

    const formattedRows = params.rows.map((row) => {
      const formattedRow: Record<string, string> = {};
      for (const field of fieldHeaders) {
        formattedRow[field.key] = this.stringifyValue(row[field.key]);
      }
      return formattedRow;
    });

    let body = '';

    switch (params.format) {
      case 'PLAIN_TEXT':
        body = formattedRows
          .map((row, index) => {
            const parts = fieldHeaders.map((field) => `${field.label}: ${row[field.key]}`);
            return `${index + 1}. ${parts.join(' | ')}`;
          })
          .join('\n');
        break;
      case 'BULLET_LIST':
        body = formattedRows
          .map((row) => {
            const parts = fieldHeaders.map((field) => `**${field.label}:** ${row[field.key]}`);
            return `- ${parts.join('; ')}`;
          })
          .join('\n');
        break;
      case 'TABLE':
      default: {
        const header = `| ${fieldHeaders.map((field) => field.label).join(' | ')} |`;
        const separator = `| ${fieldHeaders.map(() => '---').join(' | ')} |`;
        const rowsText = formattedRows
          .map(
            (row) =>
              `| ${fieldHeaders.map((field) => (row[field.key] ?? '').replace(/\n/g, ' ')).join(' | ')} |`,
          )
          .join('\n');
        body = `${header}\n${separator}\n${rowsText}`;
        break;
      }
    }

    const textBlock = `${heading}\n${body}`;
    return { textBlock };
  }

  private async getActivityTypeId() {
    if (this.activityTypeId) {
      return this.activityTypeId;
    }
    const existing = await this.prisma.activityType.findFirst({
      where: { key: 'AI_ACTION' },
    });
    if (existing) {
      this.activityTypeId = existing.id;
      return existing.id;
    }

    const created = await this.prisma.activityType.create({
      data: {
        name: 'AI Action',
        key: 'AI_ACTION',
        description: 'Entries generated automatically by the Gemini integration',
        color: '#7C3AED',
        icon: 'sparkles',
        isActive: true,
        isSystem: true,
        order: 5,
      },
    });
    this.activityTypeId = created.id;
    return created.id;
  }

  private buildActivityTargets(entityType: AiEntityType, entityId: string): CreateActivityDto['targets'] {
    switch (entityType) {
      case 'CANDIDATE':
        return { candidateId: entityId };
      case 'OPPORTUNITY':
        return { opportunityId: entityId };
      case 'CUSTOMER':
        return { customerId: entityId };
      case 'LEAD':
        return { leadId: entityId };
      case 'CONTACT':
        return { contactId: entityId };
      case 'EMPLOYEE':
        return { employeeId: entityId };
      case 'TASK':
        return { taskId: entityId };
      default:
        throw new BadRequestException(`Unsupported entity type ${entityType} for activity creation`);
    }
  }
}


