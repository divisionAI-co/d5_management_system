import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiCollectionFormat, AiCollectionKey, AiEntityType, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AttachAiActionDto,
  CreateAiActionDto,
  ListAiActionAttachmentsDto,
  ListAiActionExecutionsDto,
  UpdateAiActionDto,
} from './dto';
import { EntityFieldResolver, FieldMetadata } from './entity-field-resolver.service';
import {
  CollectionFieldResolver,
  CollectionFieldMetadata,
  CollectionSummary,
} from './collection-field-resolver.service';

interface ListOptions {
  entityType?: AiEntityType;
  includeInactive?: boolean;
}

@Injectable()
export class AiActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entityFieldResolver: EntityFieldResolver,
    private readonly collectionFieldResolver: CollectionFieldResolver,
  ) {}

  async list(options: ListOptions) {
    const where: Prisma.AiActionWhereInput = {};
    if (options.entityType) {
      where.entityType = options.entityType;
    }
    if (!options.includeInactive) {
      where.isActive = true;
    }

    const actions = await this.prisma.aiAction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
        collections: {
          orderBy: { order: 'asc' },
          include: {
            fields: { orderBy: { order: 'asc' } },
          },
        },
        _count: {
          select: { attachments: true, executions: true },
        },
      },
    });

    return actions.map((action) => this.mapAction(action));
  }

  async getById(id: string) {
    const action = await this.prisma.aiAction.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { order: 'asc' } },
        collections: {
          orderBy: { order: 'asc' },
          include: { fields: { orderBy: { order: 'asc' } } },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!action) {
      throw new NotFoundException('Gemini action not found');
    }

    return this.mapAction(action);
  }

  async create(dto: CreateAiActionDto, createdById: string) {
    this.entityFieldResolver.ensureFieldKeysSupported(dto.entityType, dto.fields.map((field) => field.fieldKey));

    if (dto.collections) {
      for (const collection of dto.collections) {
        this.collectionFieldResolver.ensureCollectionSupported(dto.entityType, collection.collectionKey);
        this.collectionFieldResolver.ensureCollectionFieldsSupported(
          dto.entityType,
          collection.collectionKey,
          collection.fields.map((field) => field.fieldKey),
        );
      }
    }

    const action = await this.prisma.aiAction.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        promptTemplate: dto.promptTemplate,
        entityType: dto.entityType,
        model: dto.model,
        isActive: dto.isActive ?? true,
        isSystem: false,
        createdBy: { connect: { id: createdById } },
        fields: {
          create: dto.fields.map((field, index) => ({
            fieldKey: field.fieldKey,
            fieldLabel: field.fieldLabel,
            metadata: this.toJson(field.metadata),
            order: field.order ?? index,
          })),
        },
        collections: dto.collections
          ? {
              create: dto.collections.map((collection, index) => ({
                collectionKey: collection.collectionKey,
                format: collection.format ?? AiCollectionFormat.TABLE,
                limit: collection.limit ?? null,
                metadata: this.toJson(collection.metadata),
                order: index,
                fields: {
                  create: collection.fields.map((field, fieldIndex) => ({
                    fieldKey: field.fieldKey,
                    fieldLabel: field.fieldLabel,
                    metadata: this.toJson(field.metadata),
                    order: field.order ?? fieldIndex,
                  })),
                },
              })),
            }
          : undefined,
      },
      include: {
        fields: { orderBy: { order: 'asc' } },
        collections: { orderBy: { order: 'asc' }, include: { fields: { orderBy: { order: 'asc' } } } },
      },
    });

    return this.mapAction(action);
  }

  async update(id: string, dto: UpdateAiActionDto) {
    const existing = await this.prisma.aiAction.findUnique({
      where: { id },
      include: { fields: true, attachments: true },
    });

    if (!existing) {
      throw new NotFoundException('Gemini action not found');
    }

    if (existing.isSystem) {
      throw new BadRequestException('System actions cannot be modified');
    }

    if (dto.entityType && dto.entityType !== existing.entityType && existing.attachments.length > 0) {
      throw new BadRequestException('Cannot change entity type while the action is attached to entities');
    }

    if (dto.fields) {
      const fieldKeys = dto.fields.map((field) => field.fieldKey);
      this.entityFieldResolver.ensureFieldKeysSupported(dto.entityType ?? existing.entityType, fieldKeys);
    }

    if (dto.collections) {
      for (const collection of dto.collections) {
        this.collectionFieldResolver.ensureCollectionSupported(
          dto.entityType ?? existing.entityType,
          collection.collectionKey,
        );
        this.collectionFieldResolver.ensureCollectionFieldsSupported(
          dto.entityType ?? existing.entityType,
          collection.collectionKey,
          collection.fields.map((field) => field.fieldKey),
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.fields) {
        await tx.aiActionField.deleteMany({ where: { actionId: id } });
        for (const [index, field] of dto.fields.entries()) {
          await tx.aiActionField.create({
            data: {
              actionId: id,
              fieldKey: field.fieldKey,
              fieldLabel: field.fieldLabel,
              metadata: this.toJson(field.metadata),
              order: field.order ?? index,
            },
          });
        }
      }

      if (dto.collections) {
        await tx.aiActionCollectionField.deleteMany({
          where: { collection: { actionId: id } },
        });
        await tx.aiActionCollection.deleteMany({ where: { actionId: id } });
        for (const [index, collection] of dto.collections.entries()) {
          await tx.aiActionCollection.create({
            data: {
              actionId: id,
              collectionKey: collection.collectionKey,
              format: collection.format ?? AiCollectionFormat.TABLE,
              limit: collection.limit ?? null,
              metadata: this.toJson(collection.metadata),
              order: index,
              fields: {
                create: collection.fields.map((field, fieldIndex) => ({
                  fieldKey: field.fieldKey,
                  fieldLabel: field.fieldLabel,
                  metadata: this.toJson(field.metadata),
                  order: field.order ?? fieldIndex,
                })),
              },
            },
          });
        }
      }

      const data: Prisma.AiActionUpdateInput = {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.promptTemplate !== undefined && { promptTemplate: dto.promptTemplate }),
        ...(dto.entityType !== undefined && { entityType: dto.entityType }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      };

      const updated = await tx.aiAction.update({
        where: { id },
        data,
        include: {
          fields: { orderBy: { order: 'asc' } },
          collections: { orderBy: { order: 'asc' }, include: { fields: { orderBy: { order: 'asc' } } } },
        },
      });

      return this.mapAction(updated);
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.aiAction.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Gemini action not found');
    }
    if (existing.isSystem) {
      throw new BadRequestException('System actions cannot be deleted');
    }

    await this.prisma.aiAction.delete({ where: { id } });
    return { id, deletedBy: userId };
  }

  listEntityFields(entityType: AiEntityType): FieldMetadata[] {
    return this.entityFieldResolver.listFields(entityType);
  }

  listCollectionDefinitions(entityType: AiEntityType): CollectionSummary[] {
    return this.collectionFieldResolver.listCollections(entityType);
  }

  listCollectionFields(entityType: AiEntityType, collectionKey: AiCollectionKey): CollectionFieldMetadata[] {
    return this.collectionFieldResolver.listCollectionFields(entityType, collectionKey);
  }

  async attach(actionId: string, dto: AttachAiActionDto, userId: string) {
    const action = await this.prisma.aiAction.findUnique({ where: { id: actionId } });
    if (!action) {
      throw new NotFoundException('Gemini action not found');
    }
    if (!action.isActive) {
      throw new BadRequestException('Action is currently inactive');
    }

    await this.entityFieldResolver.ensureEntityExists(action.entityType, dto.entityId);

    const attachment = await this.prisma.aiActionAttachment.create({
      data: {
        actionId,
        entityType: action.entityType,
        entityId: dto.entityId,
        attachedById: userId,
      },
    });

    return attachment;
  }

  async detach(attachmentId: string, userId: string) {
    const attachment = await this.prisma.aiActionAttachment.findUnique({
      where: { id: attachmentId },
      include: { action: true },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    if (attachment.action.isSystem) {
      throw new BadRequestException('Cannot detach system action');
    }

    await this.prisma.aiActionAttachment.delete({ where: { id: attachmentId } });
    return { id: attachmentId, detachedBy: userId };
  }

  async listAttachments(query: ListAiActionAttachmentsDto) {
    await this.entityFieldResolver.ensureEntityExists(query.entityType, query.entityId);

    const attachments = await this.prisma.aiActionAttachment.findMany({
      where: {
        entityType: query.entityType,
        entityId: query.entityId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        action: {
          include: {
            fields: { orderBy: { order: 'asc' } },
            collections: { orderBy: { order: 'asc' }, include: { fields: { orderBy: { order: 'asc' } } } },
          },
        },
      },
    });

    return attachments.map((attachment) => ({
      ...attachment,
      action: this.mapAction(attachment.action),
    }));
  }

  async listExecutions(query: ListAiActionExecutionsDto) {
    const where: Prisma.AiActionExecutionWhereInput = {};
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.actionId) {
      where.actionId = query.actionId;
    }

    const take = query.limit ?? 20;

    const executions = await this.prisma.aiActionExecution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        action: {
          select: {
            id: true,
            name: true,
            entityType: true,
          },
        },
        attachment: {
          select: {
            id: true,
            entityType: true,
            entityId: true,
          },
        },
      },
    });

    return executions;
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  private mapAction(action: any) {
    if (!action) {
      return action;
    }

    const collectionDefinitions = this.collectionFieldResolver
      .listCollections(action.entityType as AiEntityType)
      .reduce<Partial<Record<AiCollectionKey, { label: string; description?: string }>>>(
        (acc, definition) => {
          acc[definition.collectionKey] = { label: definition.label, description: definition.description };
          return acc;
        },
        {},
      );

    return {
      ...action,
      fields:
        action.fields?.map(
          (field: {
            id: string;
            fieldKey: string;
            fieldLabel: string;
            metadata?: Prisma.JsonValue | null;
            order: number;
          }) => ({
            id: field.id,
            fieldKey: field.fieldKey,
            fieldLabel: field.fieldLabel,
            metadata: field.metadata ?? undefined,
            order: field.order,
          }),
        ) ?? [],
      collections:
        action.collections?.map((collection: any) => {
          const definition = collectionDefinitions[collection.collectionKey as AiCollectionKey];
          return {
            id: collection.id,
            collectionKey: collection.collectionKey,
            label: definition?.label ?? collection.collectionKey,
            description: definition?.description ?? null,
            format: collection.format,
            limit: collection.limit ?? undefined,
            order: collection.order,
            metadata: collection.metadata ?? undefined,
            fields:
              collection.fields?.map(
                (field: {
                  id: string;
                  fieldKey: string;
                  fieldLabel: string;
                  metadata?: Prisma.JsonValue | null;
                  order: number;
                }) => ({
                  id: field.id,
                  fieldKey: field.fieldKey,
                  fieldLabel: field.fieldLabel,
                  metadata: field.metadata ?? undefined,
                  order: field.order,
                }),
              ) ?? [],
          };
        }) ?? [],
    };
  }
}


