import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiActionsService } from './ai-actions.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntityFieldResolver } from './entity-field-resolver.service';
import { CollectionFieldResolver } from './collection-field-resolver.service';
import {
  AiActionOperationType,
  AiCollectionFormat,
  AiCollectionKey,
  AiEntityType,
} from '@prisma/client';
import { CreateAiActionDto } from './dto/create-ai-action.dto';
import { UpdateAiActionDto } from './dto/update-ai-action.dto';
import { AttachAiActionDto } from './dto/attach-ai-action.dto';
import { ListAiActionAttachmentsDto } from './dto/list-ai-action-attachments.dto';
import { ListAiActionExecutionsDto } from './dto/list-ai-action-executions.dto';

describe('AiActionsService', () => {
  let service: AiActionsService;
  let prismaService: any;
  let entityFieldResolver: any;
  let collectionFieldResolver: any;

  const mockAction = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Action',
    description: 'Test description',
    promptTemplate: 'Analyze {{fullName}}',
    entityType: AiEntityType.CANDIDATE,
    model: 'gemini-1.5-pro-latest',
    isActive: true,
    isSystem: false,
    operationType: AiActionOperationType.READ_ONLY,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-1',
    fields: [
      {
        id: 'field-1',
        fieldKey: 'fullName',
        fieldLabel: 'Full Name',
        metadata: null,
        order: 0,
      },
    ],
    collections: [],
    fieldMappings: [],
    _count: {
      attachments: 0,
      executions: 0,
    },
  };

  beforeEach(async () => {
    const mockPrismaService: any = {
      aiAction: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      aiActionField: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      aiActionCollection: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      aiActionCollectionField: {
        deleteMany: jest.fn(),
      },
      aiActionFieldMapping: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      aiActionAttachment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      aiActionExecution: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (prisma: any) => Promise<any>) => callback(mockPrismaService)),
    };

    const mockEntityFieldResolver = {
      ensureFieldKeysSupported: jest.fn(),
      ensureEntityExists: jest.fn(),
      listFields: jest.fn(),
    };

    const mockCollectionFieldResolver = {
      ensureCollectionSupported: jest.fn(),
      ensureCollectionFieldsSupported: jest.fn(),
      listCollections: jest.fn(),
      listCollectionFields: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiActionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EntityFieldResolver,
          useValue: mockEntityFieldResolver,
        },
        {
          provide: CollectionFieldResolver,
          useValue: mockCollectionFieldResolver,
        },
      ],
    }).compile();

    service = module.get<AiActionsService>(AiActionsService);
    prismaService = module.get(PrismaService);
    entityFieldResolver = module.get(EntityFieldResolver);
    collectionFieldResolver = module.get(CollectionFieldResolver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return list of actions', async () => {
      const mockActions = [mockAction];
      prismaService.aiAction.findMany.mockResolvedValue(mockActions);
      collectionFieldResolver.listCollections.mockReturnValue([]);

      const result = await service.list({});

      expect(result).toHaveLength(1);
      expect(prismaService.aiAction.findMany).toHaveBeenCalled();
    });

    it('should filter by entity type', async () => {
      prismaService.aiAction.findMany.mockResolvedValue([]);
      collectionFieldResolver.listCollections.mockReturnValue([]);

      await service.list({ entityType: AiEntityType.CANDIDATE });

      expect(prismaService.aiAction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: AiEntityType.CANDIDATE,
            isActive: true,
          }),
        }),
      );
    });

    it('should include inactive actions when requested', async () => {
      prismaService.aiAction.findMany.mockResolvedValue([]);
      collectionFieldResolver.listCollections.mockReturnValue([]);

      await service.list({ includeInactive: true });

      expect(prismaService.aiAction.findMany).toHaveBeenCalled();
      const callArgs = prismaService.aiAction.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('isActive', true);
    });
  });

  describe('getById', () => {
    it('should return action by id', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue(mockAction);
      collectionFieldResolver.listCollections.mockReturnValue([]);

      const result = await service.getById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toBeDefined();
      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(prismaService.aiAction.findUnique).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if action not found', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto: CreateAiActionDto = {
      name: 'New Action',
      description: 'New description',
      promptTemplate: 'Analyze {{fullName}}',
      entityType: AiEntityType.CANDIDATE,
      fields: [
        {
          fieldKey: 'fullName',
          fieldLabel: 'Full Name',
        },
      ],
      isActive: true,
    };

    it('should create a new action', async () => {
      entityFieldResolver.ensureFieldKeysSupported.mockReturnValue(undefined);
      prismaService.aiAction.create.mockResolvedValue(mockAction);
      collectionFieldResolver.listCollections.mockReturnValue([]);

      const result = await service.create(createDto, 'user-1');

      expect(result).toBeDefined();
      expect(prismaService.aiAction.create).toHaveBeenCalled();
      expect(entityFieldResolver.ensureFieldKeysSupported).toHaveBeenCalledWith(
        AiEntityType.CANDIDATE,
        ['fullName'],
      );
    });

    it('should validate field keys', async () => {
      entityFieldResolver.ensureFieldKeysSupported.mockImplementation(() => {
        throw new BadRequestException('Invalid field');
      });

      await expect(service.create(createDto, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should validate collection fields when collections provided', async () => {
      const dtoWithCollections: CreateAiActionDto = {
        ...createDto,
        collections: [
          {
            collectionKey: AiCollectionKey.ACTIVITIES,
            fields: [
              {
                fieldKey: 'subject',
                fieldLabel: 'Subject',
              },
            ],
          },
        ],
      };

      entityFieldResolver.ensureFieldKeysSupported.mockReturnValue(undefined);
      collectionFieldResolver.ensureCollectionSupported.mockReturnValue(undefined);
      collectionFieldResolver.ensureCollectionFieldsSupported.mockReturnValue(undefined);
      prismaService.aiAction.create.mockResolvedValue(mockAction);
      collectionFieldResolver.listCollections.mockReturnValue([]);

      await service.create(dtoWithCollections, 'user-1');

      expect(collectionFieldResolver.ensureCollectionSupported).toHaveBeenCalled();
      expect(collectionFieldResolver.ensureCollectionFieldsSupported).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateDto: UpdateAiActionDto = {
      name: 'Updated Action',
    };

    it('should update an action', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue({
        ...mockAction,
        attachments: [],
      });
      prismaService.aiAction.update.mockResolvedValue({
        ...mockAction,
        name: 'Updated Action',
      });
      collectionFieldResolver.listCollections.mockReturnValue([]);

      const result = await service.update('123e4567-e89b-12d3-a456-426614174000', updateDto);

      expect(result.name).toBe('Updated Action');
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if action not found', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue(null);

      await expect(service.update('123e4567-e89b-12d3-a456-426614174001', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if trying to update system action', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue({
        ...mockAction,
        isSystem: true,
      });

      await expect(service.update('123e4567-e89b-12d3-a456-426614174000', updateDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if changing entity type with attachments', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue({
        ...mockAction,
        attachments: [{ id: 'attachment-1' }],
      });

      await expect(
        service.update('123e4567-e89b-12d3-a456-426614174000', { entityType: AiEntityType.EMPLOYEE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update fields when provided', async () => {
      const dtoWithFields: UpdateAiActionDto = {
        fields: [
          {
            fieldKey: 'email',
            fieldLabel: 'Email',
          },
        ],
      };

      prismaService.aiAction.findUnique.mockResolvedValue({
        ...mockAction,
        attachments: [],
      });
      entityFieldResolver.ensureFieldKeysSupported.mockReturnValue(undefined);
      prismaService.aiActionField.deleteMany.mockResolvedValue({ count: 1 });
      prismaService.aiActionField.create.mockResolvedValue({ id: 'field-2' });
      prismaService.aiAction.update.mockResolvedValue(mockAction);
      collectionFieldResolver.listCollections.mockReturnValue([]);

      await service.update('123e4567-e89b-12d3-a456-426614174000', dtoWithFields);

      expect(prismaService.aiActionField.deleteMany).toHaveBeenCalled();
      expect(prismaService.aiActionField.create).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete an action', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue(mockAction);
      prismaService.aiAction.delete.mockResolvedValue(mockAction);

      const result = await service.remove('123e4567-e89b-12d3-a456-426614174000', 'user-1');

      expect(result).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000', deletedBy: 'user-1' });
      expect(prismaService.aiAction.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if action not found', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if trying to delete system action', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue({
        ...mockAction,
        isSystem: true,
      });

      await expect(service.remove('123e4567-e89b-12d3-a456-426614174000', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('attach', () => {
    const attachDto: AttachAiActionDto = {
      entityId: 'entity-1',
    };

    it('should attach action to entity', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue(mockAction);
      entityFieldResolver.ensureEntityExists.mockResolvedValue(undefined);
      prismaService.aiActionAttachment.findUnique.mockResolvedValue(null);
      prismaService.aiActionAttachment.create.mockResolvedValue({
        id: 'attachment-1',
        actionId: '123e4567-e89b-12d3-a456-426614174000',
        entityType: AiEntityType.CANDIDATE,
        entityId: 'entity-1',
      });

      const result = await service.attach('123e4567-e89b-12d3-a456-426614174000', attachDto, 'user-1');

      expect(result).toBeDefined();
      expect(prismaService.aiActionAttachment.create).toHaveBeenCalled();
    });

    it('should return existing attachment if already attached', async () => {
      const existingAttachment = {
        id: 'attachment-1',
        actionId: '123e4567-e89b-12d3-a456-426614174000',
        entityType: AiEntityType.CANDIDATE,
        entityId: 'entity-1',
      };

      prismaService.aiAction.findUnique.mockResolvedValue(mockAction);
      entityFieldResolver.ensureEntityExists.mockResolvedValue(undefined);
      prismaService.aiActionAttachment.findUnique.mockResolvedValue(existingAttachment);

      const result = await service.attach('123e4567-e89b-12d3-a456-426614174000', attachDto, 'user-1');

      expect(result).toEqual(existingAttachment);
      expect(prismaService.aiActionAttachment.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if action not found', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue(null);

      await expect(
        service.attach('123e4567-e89b-12d3-a456-426614174000', attachDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if action is inactive', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue({
        ...mockAction,
        isActive: false,
      });

      await expect(
        service.attach('123e4567-e89b-12d3-a456-426614174000', attachDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('detach', () => {
    it('should detach action from entity', async () => {
      const attachment = {
        id: 'attachment-1',
        action: mockAction,
      };

      prismaService.aiActionAttachment.findUnique.mockResolvedValue(attachment);
      prismaService.aiActionAttachment.delete.mockResolvedValue(attachment);

      const result = await service.detach('attachment-1', 'user-1');

      expect(result).toEqual({ id: 'attachment-1', detachedBy: 'user-1' });
      expect(prismaService.aiActionAttachment.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if attachment not found', async () => {
      prismaService.aiActionAttachment.findUnique.mockResolvedValue(null);

      await expect(service.detach('non-existent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if trying to detach system action', async () => {
      prismaService.aiActionAttachment.findUnique.mockResolvedValue({
        id: 'attachment-1',
        action: {
          ...mockAction,
          isSystem: true,
        },
      });

      await expect(service.detach('attachment-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('listAttachments', () => {
    const query: ListAiActionAttachmentsDto = {
      entityType: AiEntityType.CANDIDATE,
      entityId: 'entity-1',
    };

    it('should return list of attachments', async () => {
      const mockAttachments = [
        {
          id: 'attachment-1',
          action: mockAction,
        },
      ];

      entityFieldResolver.ensureEntityExists.mockResolvedValue(undefined);
      prismaService.aiActionAttachment.findMany.mockResolvedValue(mockAttachments);
      collectionFieldResolver.listCollections.mockReturnValue([]);

      const result = await service.listAttachments(query);

      expect(result).toHaveLength(1);
      expect(prismaService.aiActionAttachment.findMany).toHaveBeenCalled();
    });
  });

  describe('listExecutions', () => {
    const query: ListAiActionExecutionsDto = {
        actionId: '123e4567-e89b-12d3-a456-426614174000',
    };

    it('should return list of executions', async () => {
      const mockExecutions = [
        {
          id: 'execution-1',
          actionId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'SUCCESS',
        },
      ];

      prismaService.aiActionExecution.findMany.mockResolvedValue(mockExecutions);

      const result = await service.listExecutions(query);

      expect(result).toHaveLength(1);
      expect(prismaService.aiActionExecution.findMany).toHaveBeenCalled();
    });
  });

  describe('listEntityFields', () => {
    it('should return list of entity fields', () => {
      const mockFields = [
        {
          key: 'fullName',
          label: 'Full Name',
        },
      ];

      entityFieldResolver.listFields.mockReturnValue(mockFields);

      const result = service.listEntityFields(AiEntityType.CANDIDATE);

      expect(result).toEqual(mockFields);
      expect(entityFieldResolver.listFields).toHaveBeenCalledWith(AiEntityType.CANDIDATE);
    });
  });

  describe('listCollectionDefinitions', () => {
    it('should return list of collection definitions', () => {
      const mockCollections = [
        {
          collectionKey: AiCollectionKey.ACTIVITIES,
          label: 'Activities',
        },
      ];

      collectionFieldResolver.listCollections.mockReturnValue(mockCollections);

      const result = service.listCollectionDefinitions(AiEntityType.CANDIDATE);

      expect(result).toEqual(mockCollections);
      expect(collectionFieldResolver.listCollections).toHaveBeenCalledWith(AiEntityType.CANDIDATE);
    });
  });

  describe('listCollectionFields', () => {
    it('should return list of collection fields', () => {
      const mockFields = [
        {
          key: 'subject',
          label: 'Subject',
        },
      ];

      collectionFieldResolver.listCollectionFields.mockReturnValue(mockFields);

      const result = service.listCollectionFields(
        AiEntityType.CANDIDATE,
        AiCollectionKey.ACTIVITIES,
      );

      expect(result).toEqual(mockFields);
      expect(collectionFieldResolver.listCollectionFields).toHaveBeenCalledWith(
        AiEntityType.CANDIDATE,
        AiCollectionKey.ACTIVITIES,
      );
    });
  });
});

