import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
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
  operationType?: 'UPDATE' | 'CREATE' | 'READ_ONLY';
  fieldMappings?: Array<{ sourceKey: string; targetField: string; transformRule?: string | null }>;
}

@Injectable()
export class AiActionExecutor {
  private readonly logger = new Logger(AiActionExecutor.name);
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

    // If action has field mappings and is UPDATE or CREATE, append JSON instruction
    let finalPrompt = prompt;
    if (action.operationType !== 'READ_ONLY' && action.fieldMappings && action.fieldMappings.length > 0) {
      const expectedKeys = action.fieldMappings.map((m: { sourceKey: string; targetField: string; transformRule?: string | null }) => m.sourceKey).join(', ');
      finalPrompt = `${prompt}\n\nIMPORTANT: Return your response as a valid JSON object with the following keys: ${expectedKeys}. Do not include any additional text or explanation, only the JSON object.`;
      this.logger.log(`Appended JSON instruction to prompt for UPDATE/CREATE action with field mappings`);
    }

    return this.executeWithGemini({
      actionId: action.id,
      attachmentId: attachment?.id,
      entityType: action.entityType,
      entityId: options.entityId ?? 'ALL', // Use 'ALL' as a placeholder for bulk operations
      model: action.model ?? undefined,
      fieldValues: promptContext,
      collectionContext: collectionsData.debugContext,
      prompt: finalPrompt,
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

    let prompt = this.interpolatePrompt(options.prompt, fieldValues, options.extraInstructions);

    // If operation type is UPDATE or CREATE and field mappings are provided, append JSON instruction
    const operationType = options.operationType ?? 'READ_ONLY';
    if (operationType !== 'READ_ONLY' && options.fieldMappings && options.fieldMappings.length > 0) {
      const expectedKeys = options.fieldMappings.map((m) => m.sourceKey).join(', ');
      prompt = `${prompt}\n\nIMPORTANT: Return your response as a valid JSON object with the following keys: ${expectedKeys}. Do not include any additional text or explanation, only the JSON object.`;
      this.logger.log(`Appended JSON instruction to ad-hoc prompt for ${operationType} operation with field mappings`);
    }

    return this.executeWithGemini({
      entityType: options.entityType,
      entityId: options.entityId ?? 'ALL', // Use 'ALL' as a placeholder for bulk operations
      model: options.model,
      fieldValues,
      prompt,
      actionName: 'Ad-hoc Gemini prompt',
      triggeredById: options.triggeredById,
      adhocOperationType: operationType,
      adhocFieldMappings: options.fieldMappings,
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
    adhocOperationType?: 'UPDATE' | 'CREATE' | 'READ_ONLY';
    adhocFieldMappings?: Array<{ sourceKey: string; targetField: string; transformRule?: string | null }>;
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
      } else if (params.adhocOperationType && params.adhocOperationType !== 'READ_ONLY' && params.adhocFieldMappings && params.adhocFieldMappings.length > 0) {
        // Handle ad-hoc actions with field mappings
        proposedChanges = await this.parseAndMapResponse({
          response: result.text,
          rawResponse: result.rawResponse,
          fieldMappings: params.adhocFieldMappings,
          entityType: params.entityType,
          entityId: params.entityId,
          operationType: params.adhocOperationType,
        });
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

      const updateData: {
        status: AiActionExecutionStatus;
        output: Prisma.InputJsonValue;
        rawOutput: string | null;
        proposedChanges?: Prisma.InputJsonValue;
        completedAt: Date;
        activityId: string | null;
      } = {
        status: 'SUCCESS' as AiActionExecutionStatus,
        output: { text: result.text } as Prisma.InputJsonValue,
        rawOutput: this.safeStringify(result.rawResponse),
        completedAt: new Date(),
        activityId: activity?.id ?? null,
      };

      // Only add proposedChanges if it exists (and if the field exists in the schema)
      if (proposedChanges !== null && proposedChanges !== undefined) {
        updateData.proposedChanges = proposedChanges as Prisma.InputJsonValue;
      }

      const updated = await prisma.aiActionExecution.update({
        where: { id: execution.id },
        data: updateData,
        include: {
          action: {
            include: {
              fieldMappings: true,
            },
          },
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
      let parsedResponse: Record<string, unknown> | null = null;
      let parseError: string | null = null;
      
      /**
       * Extracts a clean JSON string from a raw API response that may include markdown.
       * Finds the content between the first { and the last }
       */
      const extractJsonFromString = (rawText: string): string | null => {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) {
          return match[0];
        }
        return null;
      };
      
      // Helper function to safely parse JSON, handling double-stringified cases
      const parseJsonSafely = (text: string): Record<string, unknown> | null => {
        try {
          const parsed = JSON.parse(text);
          // If the parsed result is a string, it might be double-stringified JSON
          if (typeof parsed === 'string') {
            try {
              const doubleParsed = JSON.parse(parsed);
              if (typeof doubleParsed === 'object' && doubleParsed !== null && !Array.isArray(doubleParsed)) {
                this.logger.log(`Detected double-stringified JSON, parsed successfully`);
                return doubleParsed as Record<string, unknown>;
              }
            } catch {
              // If second parse fails, return null (not valid JSON)
            }
          }
          // If it's already an object, return it
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
          return null;
        } catch {
          return null;
        }
      };
      
      parsedResponse = parseJsonSafely(params.response);
      if (parsedResponse) {
        this.logger.log(`Successfully parsed Gemini response as JSON with keys: ${Object.keys(parsedResponse).join(', ')}`);
      } else {
        // If not JSON, try to extract JSON from the response
        this.logger.warn(`Initial JSON parse failed, attempting to extract JSON from response`);
        
        // Try to extract JSON from markdown code fences first (```json ... ```)
        const markdownJsonMatch = params.response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (markdownJsonMatch) {
          parsedResponse = parseJsonSafely(markdownJsonMatch[1]);
          if (parsedResponse) {
            this.logger.log(`Successfully extracted and parsed JSON from markdown code fence with keys: ${Object.keys(parsedResponse).join(', ')}`);
          } else {
            this.logger.warn(`Failed to parse JSON from markdown fence, trying generic extraction`);
          }
        }
        
        // If markdown extraction failed, try generic JSON extraction using extractJsonFromString
        if (!parsedResponse) {
          const extractedJson = extractJsonFromString(params.response);
          if (extractedJson) {
            try {
              parsedResponse = parseJsonSafely(extractedJson);
              if (parsedResponse) {
                this.logger.log(`Successfully extracted and parsed JSON from response with keys: ${Object.keys(parsedResponse).join(', ')}`);
              } else {
                parseError = 'Could not parse extracted JSON';
                this.logger.error(`Failed to parse extracted JSON: ${parseError}`);
                return null;
              }
            } catch (extractError) {
              parseError = 'Could not parse extracted JSON';
              this.logger.error(`Failed to parse extracted JSON: ${extractError}`);
              return null;
            }
          } else {
            // If no JSON found, return null (no structured data to map)
            parseError = 'No JSON structure found in response';
            this.logger.error(`No JSON structure found in Gemini response for field mapping. Response preview: ${params.response.substring(0, 200)}`);
            return null;
          }
        }
      }

      // Ensure parsedResponse is defined and is an object before proceeding
      if (!parsedResponse || typeof parsedResponse !== 'object' || Array.isArray(parsedResponse)) {
        this.logger.error(`Failed to parse Gemini response for field mapping. Parsed result is not an object. Type: ${typeof parsedResponse}, IsArray: ${Array.isArray(parsedResponse)}`);
        return null;
      }

      // For UPDATE operations, load current entity values to compare
      let currentEntityValues: Record<string, unknown> = {};
      if (params.operationType === 'UPDATE' && params.entityId && params.entityId !== 'ALL') {
        try {
          const targetFields = params.fieldMappings.map((m) => m.targetField);
          currentEntityValues = await this.entityFieldResolver.resolveFields(
            params.entityType,
            params.entityId,
            targetFields,
          );
          this.logger.log(`Loaded current entity values for comparison: ${Object.keys(currentEntityValues).join(', ')}`);
        } catch (error) {
          this.logger.warn(`Failed to load current entity values for comparison: ${(error as Error).message}`);
          // Continue without comparison - will still create proposed changes
        }
      }

      const fields: Record<string, { oldValue: unknown; newValue: unknown; sourceKey: string }> = {};
      const mappingResults: string[] = [];

      // Map each field according to mappings
      for (const mapping of params.fieldMappings) {
        // Trim targetField to handle any trailing/leading whitespace issues
        const trimmedTargetField = mapping.targetField.trim();
        const sourceValue = this.extractValue(parsedResponse, mapping.sourceKey, mapping.transformRule);
        if (sourceValue !== undefined && sourceValue !== null) {
          const oldValue = currentEntityValues[trimmedTargetField] ?? null;
          const newValue = sourceValue;
          
          // For UPDATE operations, only include fields that actually changed
          if (params.operationType === 'UPDATE') {
            // Normalize values for comparison (handle string trimming, null vs empty string, etc.)
            const normalizedOld = this.normalizeValueForComparison(oldValue);
            const normalizedNew = this.normalizeValueForComparison(newValue);
            
            if (normalizedOld === normalizedNew) {
              mappingResults.push(`⊘ ${mapping.sourceKey} -> ${trimmedTargetField} (unchanged)`);
              this.logger.log(`Skipped unchanged field: ${mapping.sourceKey} -> ${trimmedTargetField}`);
              continue; // Skip unchanged fields
            }
          }
          
          fields[trimmedTargetField] = {
            oldValue,
            newValue,
            sourceKey: mapping.sourceKey,
          };
          mappingResults.push(`✓ ${mapping.sourceKey} -> ${trimmedTargetField}`);
          this.logger.log(`Mapped field: ${mapping.sourceKey} -> ${trimmedTargetField}`);
        } else {
          mappingResults.push(`✗ ${mapping.sourceKey} (not found in response)`);
          this.logger.warn(`Field mapping failed: ${mapping.sourceKey} not found in Gemini response`);
        }
      }

      this.logger.log(`Field mapping summary: ${mappingResults.join(', ')}`);

      if (Object.keys(fields).length === 0) {
        this.logger.warn(`No fields were successfully mapped from Gemini response. Available keys: ${Object.keys(parsedResponse).join(', ')}`);
        return null;
      }

      const changes: Record<string, unknown> = {
        operation: params.operationType,
        entityType: params.entityType,
        entityId: params.entityId === 'ALL' ? null : params.entityId,
        fields,
      };

      this.logger.log(`Created proposed changes with ${Object.keys(fields).length} field(s)`);
      return changes;
    } catch (error) {
      // If parsing fails, return null (no structured changes)
      this.logger.error(`Error in parseAndMapResponse: ${(error as Error).message}`, (error as Error).stack);
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
    // Trim the key to handle trailing/leading whitespace issues
    const trimmedKey = key.trim();
    // Support dot notation (e.g., "person.name")
    const keys = trimmedKey.split('.').map(k => k.trim());
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
   * Normalize values for comparison (handles string trimming, null vs empty string, etc.)
   */
  private normalizeValueForComparison(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    // For other types, convert to string for comparison
    return String(value).trim();
  }

  /**
   * Apply proposed changes to the database
   */
  async applyChanges(executionId: string, triggeredById: string) {
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

      // Get current entity values (reload to ensure we have latest, but use oldValue from proposedChanges for display)
      const currentEntity = await this.entityFieldResolver.resolveFields(
        changes.entityType,
        changes.entityId,
        Object.keys(changes.fields),
      );

      // Build update data
      const updateData: Record<string, unknown> = {};
      const appliedFields: Record<string, { oldValue: unknown; newValue: unknown }> = {};

      for (const [fieldKey, change] of Object.entries(changes.fields)) {
        // Trim field keys to handle any trailing/leading whitespace issues
        const trimmedKey = fieldKey.trim();
        
        // Use oldValue from proposedChanges if available (what user saw), otherwise use current value
        const oldValue = change.oldValue !== null && change.oldValue !== undefined 
          ? change.oldValue 
          : (currentEntity[trimmedKey] ?? null);
        updateData[trimmedKey] = change.newValue;
        appliedFields[trimmedKey] = {
          oldValue,
          newValue: change.newValue,
        };
        this.logger.log(`Field ${trimmedKey}: oldValue=${JSON.stringify(oldValue)}, newValue=${JSON.stringify(change.newValue)}`);
      }

      this.logger.log(`Applying changes to ${changes.entityType} ${changes.entityId} with ${Object.keys(updateData).length} field(s): ${Object.keys(updateData).join(', ')}`);
      this.logger.log(`Update data: ${JSON.stringify(updateData, null, 2)}`);

      // Update the entity based on type
      try {
        await this.updateEntity(changes.entityType, changes.entityId, updateData);
        this.logger.log(`Successfully applied changes to ${changes.entityType} ${changes.entityId}`);
      } catch (error) {
        this.logger.error(`Failed to apply changes to ${changes.entityType} ${changes.entityId}: ${(error as Error).message}`, (error as Error).stack);
        throw error;
      }

      // Update execution with applied changes
      const appliedChanges = {
        ...changes,
        fields: appliedFields,
        appliedAt: new Date().toISOString(),
      };

      const updated = await prisma.aiActionExecution.update({
        where: { id: executionId },
        data: {
          appliedChanges: appliedChanges as Prisma.InputJsonValue,
          appliedAt: new Date(),
        },
        include: {
          action: {
            include: {
              fieldMappings: true,
            },
          },
        },
      });

      return updated;
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

      const updated = await prisma.aiActionExecution.update({
        where: { id: executionId },
        data: {
          appliedChanges: appliedChanges as Prisma.InputJsonValue,
          appliedAt: new Date(),
          entityId: newEntity.id, // Update execution with created entity ID
        },
        include: {
          action: {
            include: {
              fieldMappings: true,
            },
          },
        },
      });

      return updated;
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
        const sanitizedData = this.sanitizeQuoteData(data);
        this.logger.log(`Updating quote ${entityId} with sanitized data keys: ${Object.keys(sanitizedData).join(', ')}`);
        this.logger.log(`Sanitized data values: ${JSON.stringify(sanitizedData, null, 2)}`);
        
        if (Object.keys(sanitizedData).length === 0) {
          this.logger.warn(`No valid fields to update for quote ${entityId}. Original data had keys: ${Object.keys(data).join(', ')}`);
          throw new BadRequestException('No valid fields to update. Check that field mappings match allowed quote fields.');
        }
        
        // Verify quote exists before updating
        const existingQuote = await prisma.quote.findUnique({
          where: { id: entityId },
          select: { id: true, title: true },
        });
        
        if (!existingQuote) {
          this.logger.error(`Quote ${entityId} not found`);
          throw new NotFoundException(`Quote with ID ${entityId} not found`);
        }
        
        this.logger.log(`Quote ${entityId} exists. Current title: ${existingQuote.title}`);
        
        try {
          const updated = await prisma.quote.update({
            where: { id: entityId },
            data: sanitizedData,
          });
          this.logger.log(`Successfully updated quote ${entityId}. Updated title: ${updated.title}`);
          this.logger.log(`Updated fields: ${Object.keys(sanitizedData).join(', ')}`);
        } catch (updateError) {
          this.logger.error(`Prisma update failed for quote ${entityId}: ${(updateError as Error).message}`, (updateError as Error).stack);
          throw updateError;
        }
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
      'milestones',
      'paymentTerms',
      'warrantyPeriod',
      'totalValue',
      'currency',
      'status',
    ];
    
    this.logger.log(`Sanitizing quote data. Input keys: ${Object.keys(data).join(', ')}`);
    this.logger.log(`Input data: ${JSON.stringify(data, null, 2)}`);
    
    // Normalize input data by trimming keys to handle trailing/leading whitespace
    const normalizedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const trimmedKey = key.trim();
      // If there are duplicate keys after trimming, keep the last one
      normalizedData[trimmedKey] = value;
    }
    
    for (const key of allowedFields) {
      if (key in normalizedData) {
        const value = normalizedData[key];
        
        // Skip undefined values (Prisma will ignore them anyway, but we want to be explicit)
        if (value === undefined) {
          this.logger.log(`Skipping ${key} because it's undefined`);
          continue;
        }
        
        // Convert totalValue to Prisma.Decimal if it's a number or string
        if (key === 'totalValue' && value !== null && value !== undefined) {
          try {
            sanitized[key] = new Prisma.Decimal(value as string | number);
            this.logger.log(`Converted totalValue to Decimal: ${sanitized[key]}`);
          } catch (error) {
            this.logger.error(`Failed to convert totalValue to Decimal: ${(error as Error).message}`);
            // Skip invalid totalValue rather than failing the entire update
            continue;
          }
        } else {
          // For other fields, include null values (they're valid for nullable fields)
          sanitized[key] = value;
          this.logger.log(`Including field ${key} with value: ${typeof value === 'string' ? value.substring(0, 50) : value}`);
        }
      }
    }
    
    this.logger.log(`Sanitized quote data with ${Object.keys(sanitized).length} field(s): ${Object.keys(sanitized).join(', ')}`);
    return sanitized;
  }
}


