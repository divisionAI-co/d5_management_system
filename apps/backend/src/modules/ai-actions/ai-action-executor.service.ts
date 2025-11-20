import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ActivityVisibility, AiEntityType, AiCollectionKey, AiCollectionFormat, AiActionExecutionStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { CreateActivityDto } from '../activities/dto/create-activity.dto';
import { GeminiService } from './gemini.service';
import { EntityFieldResolver } from './entity-field-resolver.service';
import { CollectionFieldResolver } from './collection-field-resolver.service';

interface ExecuteSavedActionOptions {
  actionId: string;
  entityId?: string; // Optional: if omitted, runs on all records
  fieldKeysOverride?: string[];
  promptOverride?: string;
  extraInstructions?: string;
  triggeredById: string;
}

interface ExecuteAdhocOptions {
  entityType: AiEntityType;
  entityId?: string; // Optional: if omitted, runs on all records
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
        fieldMappings: { orderBy: { order: 'asc' } },
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

    // For bulk operations (no entityId), skip field resolution or use aggregate data
    const fieldValues = options.entityId
      ? await this.entityFieldResolver.resolveFields(
          action.entityType,
          options.entityId,
          fieldKeys,
        )
      : {}; // Empty field values for bulk operations

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

    const attachment = options.entityId
      ? await prisma.aiActionAttachment.findFirst({
          where: {
            actionId: action.id,
            entityType: action.entityType,
            entityId: options.entityId,
          },
          select: { id: true },
        })
      : undefined;

    return this.executeWithGemini({
      actionId: action.id,
      attachmentId: attachment?.id,
      entityType: action.entityType,
      entityId: options.entityId ?? 'ALL', // Use 'ALL' as a placeholder for bulk operations
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
    // For bulk operations (no entityId), skip field resolution
    const fieldValues = options.entityId
      ? await this.entityFieldResolver.resolveFields(
          options.entityType,
          options.entityId,
          options.fieldKeys,
        )
      : {}; // Empty field values for bulk operations

    const prompt = this.interpolatePrompt(options.prompt, fieldValues, options.extraInstructions);

    return this.executeWithGemini({
      entityType: options.entityType,
      entityId: options.entityId ?? 'ALL', // Use 'ALL' as a placeholder for bulk operations
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

      // Load action with field mappings if this is a saved action
      let action = null;
      let proposedChanges = null;
      if (params.actionId) {
        action = await prisma.aiAction.findUnique({
          where: { id: params.actionId },
          include: { fieldMappings: { orderBy: { order: 'asc' } } },
        });

        // If action has field mappings and is UPDATE or CREATE, parse response and create preview
        if (action && action.operationType !== 'READ_ONLY' && action.fieldMappings && action.fieldMappings.length > 0) {
          proposedChanges = await this.parseAndMapResponse({
            response: result.text,
            rawResponse: result.rawResponse,
            fieldMappings: action.fieldMappings,
            entityType: params.entityType,
            entityId: params.entityId,
            operationType: action.operationType,
          });
        }
      }

      // For bulk operations (entityId === 'ALL'), skip activity creation
      // as activities require at least one target entity
      const activity = params.entityId !== 'ALL'
        ? await this.createActivityForExecution({
            executionId: execution.id,
            entityType: params.entityType,
            entityId: params.entityId,
            triggeredById: params.triggeredById,
            actionName: params.actionName,
            outputText: result.text,
            fieldValues: params.fieldValues,
            collections: params.collectionContext,
          })
        : null;

      const updated = await prisma.aiActionExecution.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCESS' as AiActionExecutionStatus,
          output: { text: result.text } as Prisma.InputJsonValue,
          rawOutput: this.safeStringify(result.rawResponse),
          proposedChanges: proposedChanges as Prisma.InputJsonValue | undefined,
          completedAt: new Date(),
          activityId: activity?.id ?? null,
        },
        include: {
          action: true,
          activity: activity ? true : false,
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
    // For bulk operations (entityId === 'ALL'), skip activity creation
    // as activities require at least one target entity
    if (params.entityId === 'ALL') {
      return null;
    }

    const activityTypeId = await this.getActivityTypeId();

    const targets = this.buildActivityTargets(params.entityType, params.entityId);
    if (!targets) {
      return null; // Should not happen for non-bulk operations, but handle gracefully
    }

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
    entityId?: string; // Optional: if omitted, runs on all records
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
        entityId: params.entityId, // Can be undefined for bulk operations
        collectionKey: collection.collectionKey,
        limit: collection.limit ?? definition.defaultLimit,
        fieldKeys,
        filters: this.extractCollectionFilters(collection.metadata),
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

  private extractCollectionFilters(metadata: Prisma.JsonValue | null | undefined): Record<string, unknown> | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return undefined;
    }

    const record = metadata as Record<string, unknown>;
    const filters = record.filters;

    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      return undefined;
    }

    return filters as Record<string, unknown>;
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

  private buildActivityTargets(entityType: AiEntityType, entityId: string): CreateActivityDto['targets'] | undefined {
    // For bulk operations, entityId will be 'ALL', so we don't set specific targets
    if (entityId === 'ALL') {
      return undefined; // No specific entity target for bulk operations
    }

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
      case 'QUOTE':
        return { quoteId: entityId };
      case 'RECRUITER_PERFORMANCE_REPORT':
      case 'SALES_PERFORMANCE_REPORT':
        // Reports don't have specific activity targets, return undefined
        return undefined;
      default:
        throw new BadRequestException(`Unsupported entity type ${entityType} for activity creation`);
    }
  }

  /**
   * Parse Gemini response and map to database fields based on field mappings
   */
  private async parseAndMapResponse(params: {
    response: string;
    rawResponse: unknown;
    fieldMappings: Array<{ sourceKey: string; targetField: string; transformRule?: string | null }>;
    entityType: AiEntityType;
    entityId: string;
    operationType: string;
  }): Promise<Record<string, unknown> | null> {
    try {
      // Try to parse response as JSON first
      let parsedResponse: Record<string, unknown>;
      try {
        parsedResponse = JSON.parse(params.response);
      } catch {
        // If not JSON, try to extract JSON from the response
        const jsonMatch = params.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          // If no JSON found, return null (no structured data to map)
          return null;
        }
      }

      const fields: Record<string, { oldValue: unknown; newValue: unknown; sourceKey: string }> = {};

      // Map each field according to mappings
      for (const mapping of params.fieldMappings) {
        const sourceValue = this.extractValue(parsedResponse, mapping.sourceKey, mapping.transformRule);
        if (sourceValue !== undefined && sourceValue !== null) {
          fields[mapping.targetField] = {
            oldValue: null, // Will be populated when applying
            newValue: sourceValue,
            sourceKey: mapping.sourceKey,
          };
        }
      }

      if (Object.keys(fields).length === 0) {
        return null;
      }

      const changes: Record<string, unknown> = {
        operation: params.operationType,
        entityType: params.entityType,
        entityId: params.entityId === 'ALL' ? null : params.entityId,
        fields,
      };

      return changes;
    } catch (error) {
      // If parsing fails, return null (no structured changes)
      return null;
    }
  }

  /**
   * Extract value from parsed response, optionally applying transformation
   */
  private extractValue(
    data: Record<string, unknown>,
    key: string,
    transformRule?: string | null,
  ): unknown {
    // Support dot notation (e.g., "person.name")
    const keys = key.split('.');
    let value: unknown = data;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }

    // Apply transformation if provided
    if (transformRule && value !== undefined) {
      try {
        // Simple transformation rules (can be extended)
        // For now, support JSON path expressions
        if (transformRule.startsWith('json:')) {
          const jsonPath = transformRule.substring(5).trim();
          const jsonValue = JSON.parse(jsonPath);
          return jsonValue;
        }
        // Add more transformation rules as needed
      } catch {
        // If transformation fails, return original value
      }
    }

    return value;
  }

  /**
   * Apply proposed changes to the database
   */
  async applyChanges(executionId: string, triggeredById: string): Promise<Record<string, unknown>> {
    const prisma = this.prisma as any;

    const execution = await prisma.aiActionExecution.findUnique({
      where: { id: executionId },
      include: { action: true },
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    if (execution.status !== 'SUCCESS') {
      throw new BadRequestException('Execution must be successful before applying changes');
    }

    if (execution.appliedAt) {
      throw new BadRequestException('Changes have already been applied');
    }

    if (!execution.proposedChanges) {
      throw new BadRequestException('No proposed changes to apply');
    }

    const changes = execution.proposedChanges as {
      operation: string;
      entityType: AiEntityType;
      entityId: string | null;
      fields: Record<string, { oldValue: unknown; newValue: unknown; sourceKey: string }>;
    };

    if (changes.operation === 'UPDATE') {
      if (!changes.entityId) {
        throw new BadRequestException('Entity ID is required for UPDATE operations');
      }

      // Get current entity values
      const currentEntity = await this.entityFieldResolver.resolveFields(
        changes.entityType,
        changes.entityId,
        Object.keys(changes.fields),
      );

      // Build update data
      const updateData: Record<string, unknown> = {};
      const appliedFields: Record<string, { oldValue: unknown; newValue: unknown }> = {};

      for (const [fieldKey, change] of Object.entries(changes.fields)) {
        const oldValue = currentEntity[fieldKey] ?? null;
        updateData[fieldKey] = change.newValue;
        appliedFields[fieldKey] = {
          oldValue,
          newValue: change.newValue,
        };
      }

      // Update the entity based on type
      await this.updateEntity(changes.entityType, changes.entityId, updateData);

      // Update execution with applied changes
      const appliedChanges = {
        ...changes,
        fields: appliedFields,
        appliedAt: new Date().toISOString(),
      };

      await prisma.aiActionExecution.update({
        where: { id: executionId },
        data: {
          appliedChanges: appliedChanges as Prisma.InputJsonValue,
          appliedAt: new Date(),
        },
      });

      return appliedChanges;
    } else if (changes.operation === 'CREATE') {
      // Create new entity
      const createData: Record<string, unknown> = {};
      for (const [fieldKey, change] of Object.entries(changes.fields)) {
        createData[fieldKey] = change.newValue;
      }

      const newEntity = await this.createEntity(changes.entityType, createData);

      const appliedChanges = {
        ...changes,
        createdEntityId: newEntity.id,
        fields: Object.fromEntries(
          Object.entries(changes.fields).map(([key, change]) => [
            key,
            { oldValue: null, newValue: change.newValue },
          ]),
        ),
        appliedAt: new Date().toISOString(),
      };

      await prisma.aiActionExecution.update({
        where: { id: executionId },
        data: {
          appliedChanges: appliedChanges as Prisma.InputJsonValue,
          appliedAt: new Date(),
          entityId: newEntity.id, // Update execution with created entity ID
        },
      });

      return appliedChanges;
    } else {
      throw new BadRequestException(`Unsupported operation type: ${changes.operation}`);
    }
  }

  /**
   * Update an existing entity
   */
  private async updateEntity(
    entityType: AiEntityType,
    entityId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const prisma = this.prisma as any;

    switch (entityType) {
      case 'CANDIDATE': {
        await prisma.candidate.update({
          where: { id: entityId },
          data: this.sanitizeCandidateData(data),
        });
        break;
      }
      case 'EMPLOYEE': {
        await prisma.employee.update({
          where: { id: entityId },
          data: this.sanitizeEmployeeData(data),
        });
        break;
      }
      case 'QUOTE': {
        await prisma.quote.update({
          where: { id: entityId },
          data: this.sanitizeQuoteData(data),
        });
        break;
      }
      // Add more entity types as needed
      default:
        throw new BadRequestException(`Update not supported for entity type: ${entityType}`);
    }
  }

  /**
   * Create a new entity
   */
  private async createEntity(
    entityType: AiEntityType,
    data: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const prisma = this.prisma as any;

    switch (entityType) {
      case 'QUOTE': {
        const quote = await prisma.quote.create({
          data: this.sanitizeQuoteData(data),
        });
        return { id: quote.id };
      }
      // Add more entity types as needed
      default:
        throw new BadRequestException(`Create not supported for entity type: ${entityType}`);
    }
  }

  /**
   * Sanitize and validate data for Candidate updates
   */
  private sanitizeCandidateData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'skills',
      'experience',
      'education',
      'notes',
      'status',
      'source',
    ];
    for (const key of allowedFields) {
      if (key in data) {
        sanitized[key] = data[key];
      }
    }
    return sanitized;
  }

  /**
   * Sanitize and validate data for Employee updates
   */
  private sanitizeEmployeeData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const allowedFields = ['department', 'jobTitle', 'status', 'contractType'];
    for (const key of allowedFields) {
      if (key in data) {
        sanitized[key] = data[key];
      }
    }
    return sanitized;
  }

  /**
   * Sanitize and validate data for Quote updates/creates
   */
  private sanitizeQuoteData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const allowedFields = [
      'title',
      'description',
      'overview',
      'functionalProposal',
      'technicalProposal',
      'teamComposition',
      'paymentTerms',
      'warrantyPeriod',
      'totalValue',
      'currency',
      'status',
    ];
    for (const key of allowedFields) {
      if (key in data) {
        sanitized[key] = data[key];
      }
    }
    return sanitized;
  }
}


