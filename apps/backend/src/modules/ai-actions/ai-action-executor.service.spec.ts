import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiActionExecutor } from './ai-action-executor.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { GeminiService } from './gemini.service';
import { EntityFieldResolver } from './entity-field-resolver.service';
import { CollectionFieldResolver } from './collection-field-resolver.service';
import {
  AiActionExecutionStatus,
  AiActionOperationType,
  AiEntityType,
} from '@prisma/client';

describe('AiActionExecutor', () => {
  let service: AiActionExecutor;
  let prismaService: any;
  let activitiesService: any;
  let geminiService: any;
  let entityFieldResolver: any;
  let collectionFieldResolver: any;

  const mockAction = {
    id: 'action-1',
    name: 'Test Action',
    promptTemplate: 'Analyze {{fullName}}',
    entityType: AiEntityType.CANDIDATE,
    model: 'gemini-1.5-pro-latest',
    isActive: true,
    operationType: AiActionOperationType.READ_ONLY,
    fields: [
      {
        fieldKey: 'fullName',
      },
    ],
    collections: [],
    fieldMappings: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      aiAction: {
        findUnique: jest.fn(),
      },
      aiActionAttachment: {
        findFirst: jest.fn(),
      },
      aiActionExecution: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      candidate: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      employee: {
        update: jest.fn(),
      },
      quote: {
        update: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      activityType: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockActivitiesService = {
      create: jest.fn(),
    };

    const mockGeminiService = {
      generateText: jest.fn(),
    };

    const mockEntityFieldResolver = {
      ensureFieldKeysSupported: jest.fn(),
      resolveFields: jest.fn(),
    };

    const mockCollectionFieldResolver = {
      getCollectionDefinition: jest.fn(),
      resolveCollection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiActionExecutor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ActivitiesService,
          useValue: mockActivitiesService,
        },
        {
          provide: GeminiService,
          useValue: mockGeminiService,
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

    service = module.get<AiActionExecutor>(AiActionExecutor);
    prismaService = module.get(PrismaService);
    activitiesService = module.get(ActivitiesService);
    geminiService = module.get(GeminiService);
    entityFieldResolver = module.get(EntityFieldResolver);
    collectionFieldResolver = module.get(CollectionFieldResolver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeSavedAction', () => {
    it('should execute a saved action successfully', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue(mockAction);
      entityFieldResolver.ensureFieldKeysSupported.mockReturnValue(undefined);
      entityFieldResolver.resolveFields.mockResolvedValue({
        fullName: 'John Doe',
      });
      collectionFieldResolver.getCollectionDefinition.mockReturnValue(null);
      prismaService.aiActionAttachment.findFirst.mockResolvedValue(null);
      prismaService.aiActionExecution.create.mockResolvedValue({
        id: 'execution-1',
        status: AiActionExecutionStatus.PENDING,
      });
      geminiService.generateText.mockResolvedValue({
        text: 'Generated response',
        rawResponse: {},
      });
      prismaService.activityType.findFirst.mockResolvedValue({
        id: 'activity-type-1',
        key: 'AI_ACTION',
      });
      activitiesService.create.mockResolvedValue({
        id: 'activity-1',
      });
      prismaService.aiAction.findUnique.mockResolvedValue({
        ...mockAction,
        fieldMappings: [],
      });
      prismaService.aiActionExecution.update.mockResolvedValue({
        id: 'execution-1',
        status: AiActionExecutionStatus.SUCCESS,
        output: { text: 'Generated response' },
      });

      const result = await service.executeSavedAction({
        actionId: 'action-1',
        entityId: 'entity-1',
        triggeredById: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(AiActionExecutionStatus.SUCCESS);
      expect(geminiService.generateText).toHaveBeenCalled();
    });

    it('should throw NotFoundException if action not found', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue(null);

      await expect(
        service.executeSavedAction({
          actionId: 'non-existent',
          entityId: 'entity-1',
          triggeredById: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if action is inactive', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue({
        ...mockAction,
        isActive: false,
      });

      await expect(
        service.executeSavedAction({
          actionId: 'action-1',
          entityId: 'entity-1',
          triggeredById: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle bulk operations (no entityId)', async () => {
      prismaService.aiAction.findUnique.mockResolvedValue(mockAction);
      entityFieldResolver.ensureFieldKeysSupported.mockReturnValue(undefined);
      collectionFieldResolver.getCollectionDefinition.mockReturnValue(null);
      prismaService.aiActionExecution.create.mockResolvedValue({
        id: 'execution-1',
        status: AiActionExecutionStatus.PENDING,
      });
      geminiService.generateText.mockResolvedValue({
        text: 'Generated response',
        rawResponse: {},
      });
      prismaService.aiAction.findUnique.mockResolvedValue({
        ...mockAction,
        fieldMappings: [],
      });
      prismaService.aiActionExecution.update.mockResolvedValue({
        id: 'execution-1',
        status: AiActionExecutionStatus.SUCCESS,
        output: { text: 'Generated response' },
      });

      const result = await service.executeSavedAction({
        actionId: 'action-1',
        triggeredById: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(AiActionExecutionStatus.SUCCESS);
    });
  });

  describe('executeAdhoc', () => {
    it('should execute an ad-hoc action successfully', async () => {
      entityFieldResolver.ensureFieldKeysSupported.mockReturnValue(undefined);
      entityFieldResolver.resolveFields.mockResolvedValue({
        fullName: 'John Doe',
      });
      prismaService.aiActionExecution.create.mockResolvedValue({
        id: 'execution-1',
        status: AiActionExecutionStatus.PENDING,
      });
      geminiService.generateText.mockResolvedValue({
        text: 'Generated response',
        rawResponse: {},
      });
      prismaService.activityType.findFirst.mockResolvedValue({
        id: 'activity-type-1',
        key: 'AI_ACTION',
      });
      activitiesService.create.mockResolvedValue({
        id: 'activity-1',
      });
      prismaService.aiActionExecution.update.mockResolvedValue({
        id: 'execution-1',
        status: AiActionExecutionStatus.SUCCESS,
        output: { text: 'Generated response' },
      });

      const result = await service.executeAdhoc({
        entityType: AiEntityType.CANDIDATE,
        entityId: 'entity-1',
        fieldKeys: ['fullName'],
        prompt: 'Analyze this candidate',
        triggeredById: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(AiActionExecutionStatus.SUCCESS);
      expect(geminiService.generateText).toHaveBeenCalled();
    });

    it('should handle field mappings for UPDATE operations', async () => {
      entityFieldResolver.ensureFieldKeysSupported.mockReturnValue(undefined);
      entityFieldResolver.resolveFields.mockResolvedValue({
        fullName: 'John Doe',
      });
      prismaService.aiActionExecution.create.mockResolvedValue({
        id: 'execution-1',
        status: AiActionExecutionStatus.PENDING,
      });
      geminiService.generateText.mockResolvedValue({
        text: '{"skills": ["JavaScript", "TypeScript"]}',
        rawResponse: {},
      });
      prismaService.activityType.findFirst.mockResolvedValue({
        id: 'activity-type-1',
        key: 'AI_ACTION',
      });
      activitiesService.create.mockResolvedValue({
        id: 'activity-1',
      });
      prismaService.aiActionExecution.update.mockResolvedValue({
        id: 'execution-1',
        status: AiActionExecutionStatus.SUCCESS,
        output: { text: '{"skills": ["JavaScript", "TypeScript"]}' },
        proposedChanges: {
          operation: 'UPDATE',
          fields: {
            skills: {
              oldValue: null,
              newValue: ['JavaScript', 'TypeScript'],
              sourceKey: 'skills',
            },
          },
        },
      });

      const result = await service.executeAdhoc({
        entityType: AiEntityType.CANDIDATE,
        entityId: 'entity-1',
        fieldKeys: ['fullName'],
        prompt: 'Extract skills',
        triggeredById: 'user-1',
        operationType: 'UPDATE',
        fieldMappings: [
          {
            sourceKey: 'skills',
            targetField: 'skills',
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.proposedChanges).toBeDefined();
    });
  });

  describe('applyChanges', () => {
    const mockExecution = {
      id: 'execution-1',
      status: AiActionExecutionStatus.SUCCESS,
      appliedAt: null,
      proposedChanges: {
        operation: 'UPDATE',
        entityType: AiEntityType.CANDIDATE,
        entityId: 'candidate-1',
        fields: {
          skills: {
            oldValue: null,
            newValue: ['JavaScript', 'TypeScript'],
            sourceKey: 'skills',
          },
        },
      },
      action: {
        id: 'action-1',
        fieldMappings: [],
      },
    };

    it('should apply changes for UPDATE operation', async () => {
      prismaService.aiActionExecution.findUnique.mockResolvedValue(mockExecution);
      entityFieldResolver.resolveFields.mockResolvedValue({
        skills: null,
      });
      prismaService.candidate.update.mockResolvedValue({
        id: 'candidate-1',
        skills: ['JavaScript', 'TypeScript'],
      });
      prismaService.aiActionExecution.update.mockResolvedValue({
        ...mockExecution,
        appliedAt: new Date(),
        appliedChanges: {
          ...mockExecution.proposedChanges,
          appliedAt: new Date().toISOString(),
        },
      });

      const result = await service.applyChanges('execution-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.appliedAt).toBeDefined();
      expect(prismaService.candidate.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if execution not found', async () => {
      prismaService.aiActionExecution.findUnique.mockResolvedValue(null);

      await expect(service.applyChanges('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if execution is not successful', async () => {
      prismaService.aiActionExecution.findUnique.mockResolvedValue({
        ...mockExecution,
        status: AiActionExecutionStatus.FAILED,
      });

      await expect(service.applyChanges('execution-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if changes already applied', async () => {
      prismaService.aiActionExecution.findUnique.mockResolvedValue({
        ...mockExecution,
        appliedAt: new Date(),
      });

      await expect(service.applyChanges('execution-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if proposed changes missing', async () => {
      prismaService.aiActionExecution.findUnique.mockResolvedValue({
        ...mockExecution,
        proposedChanges: null,
      });

      await expect(service.applyChanges('execution-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should apply changes for CREATE operation', async () => {
      const createExecution = {
        ...mockExecution,
        proposedChanges: {
          operation: 'CREATE',
          entityType: AiEntityType.QUOTE,
          entityId: null,
          fields: {
            title: {
              oldValue: null,
              newValue: 'New Quote',
              sourceKey: 'title',
            },
          },
        },
      };

      prismaService.aiActionExecution.findUnique.mockResolvedValue(createExecution);
      prismaService.quote.create.mockResolvedValue({
        id: 'quote-1',
        title: 'New Quote',
      });
      prismaService.aiActionExecution.update.mockResolvedValue({
        ...createExecution,
        appliedAt: new Date(),
        entityId: 'quote-1',
      });

      const result = await service.applyChanges('execution-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.entityId).toBe('quote-1');
      expect(prismaService.quote.create).toHaveBeenCalled();
    });
  });
});

