import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { TemplatesService } from '../templates/templates.service';
import { NotificationType, TemplateType } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaService: any;
  let emailService: any;
  let templatesService: any;
  let configService: any;

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockNotification = {
    id: 'notification-1',
    userId: 'user-1',
    type: NotificationType.TASK_ASSIGNED,
    title: 'Task Assigned',
    message: 'You have been assigned a new task',
    entityType: 'task',
    entityId: 'task-1',
    isRead: false,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNotificationSettings = {
    userId: 'user-1',
    inAppEnabled: true,
    emailEnabled: true,
    taskAssigned: true,
    taskDueSoon: true,
    leaveApproved: true,
    performanceReview: true,
    feedbackReport: true,
    newCandidate: true,
    newOpportunity: true,
    mentionedInActivity: true,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      notificationSettings: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      activity: {
        findUnique: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
      },
    };

    const mockEmailService = {
      sendEmail: jest.fn(),
    };

    const mockTemplatesService = {
      renderDefault: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: TemplatesService,
          useValue: mockTemplatesService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prismaService = module.get(PrismaService);
    emailService = module.get(EmailService);
    templatesService = module.get(TemplatesService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecentNotifications', () => {
    it('should return recent notifications for user', async () => {
      prismaService.notification.findMany.mockResolvedValue([mockNotification]);

      const result = await service.getRecentNotifications('user-1', 20);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(prismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      );
    });

    it('should limit results to maximum 50', async () => {
      prismaService.notification.findMany.mockResolvedValue([]);

      await service.getRecentNotifications('user-1', 100);

      expect(prismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    it('should enforce minimum limit of 1', async () => {
      prismaService.notification.findMany.mockResolvedValue([]);

      await service.getRecentNotifications('user-1', 0);

      expect(prismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      prismaService.notification.findFirst.mockResolvedValue(mockNotification);
      prismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      });

      const result = await service.markAsRead('user-1', 'notification-1');

      expect(result).toBeDefined();
      expect(result.isRead).toBe(true);
      expect(prismaService.notification.update).toHaveBeenCalled();
    });

    it('should return notification if already read', async () => {
      const readNotification = {
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      };

      prismaService.notification.findFirst.mockResolvedValue(readNotification);

      const result = await service.markAsRead('user-1', 'notification-1');

      expect(result).toBeDefined();
      expect(result.isRead).toBe(true);
      expect(prismaService.notification.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      prismaService.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should only mark notification if it belongs to user', async () => {
      prismaService.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'notification-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('shouldNotifyUser', () => {
    it('should return true when no settings exist (default enabled)', async () => {
      prismaService.notificationSettings.findUnique.mockResolvedValue(null);

      const result = await service.shouldNotifyUser('user-1', NotificationType.TASK_ASSIGNED);

      expect(result).toBe(true);
    });

    it('should return false when in-app notifications disabled globally', async () => {
      const settings = {
        ...mockNotificationSettings,
        inAppEnabled: false,
      };

      prismaService.notificationSettings.findUnique.mockResolvedValue(settings);

      const result = await service.shouldNotifyUser('user-1', NotificationType.TASK_ASSIGNED);

      expect(result).toBe(false);
    });

    it('should check type-specific preference for TASK_ASSIGNED', async () => {
      const settings = {
        ...mockNotificationSettings,
        taskAssigned: false,
      };

      prismaService.notificationSettings.findUnique.mockResolvedValue(settings);

      const result = await service.shouldNotifyUser('user-1', NotificationType.TASK_ASSIGNED);

      expect(result).toBe(false);
    });

    it('should check type-specific preference for LEAVE_APPROVED', async () => {
      const settings = {
        ...mockNotificationSettings,
        leaveApproved: false,
      };

      prismaService.notificationSettings.findUnique.mockResolvedValue(settings);

      const result = await service.shouldNotifyUser('user-1', NotificationType.LEAVE_APPROVED);

      expect(result).toBe(false);
    });

    it('should check type-specific preference for MENTIONED_IN_ACTIVITY', async () => {
      const settings = {
        ...mockNotificationSettings,
        mentionedInActivity: false,
      };

      prismaService.notificationSettings.findUnique.mockResolvedValue(settings);

      const result = await service.shouldNotifyUser('user-1', NotificationType.MENTIONED_IN_ACTIVITY);

      expect(result).toBe(false);
    });

    it('should default to true for unknown notification types', async () => {
      prismaService.notificationSettings.findUnique.mockResolvedValue(mockNotificationSettings);

      const result = await service.shouldNotifyUser('user-1', NotificationType.SYSTEM);

      expect(result).toBe(true);
    });
  });

  describe('createNotification', () => {
    it('should create notification when user preferences allow', async () => {
      prismaService.notificationSettings.findUnique.mockResolvedValue(mockNotificationSettings);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      emailService.sendEmail.mockResolvedValue(true);
      configService.get.mockReturnValue('http://localhost:3000');

      const result = await service.createNotification(
        'user-1',
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a new task',
        'task',
        'task-1',
      );

      expect(result).toBeDefined();
      expect(prismaService.notification.create).toHaveBeenCalled();
    });

    it('should return null when user preferences disallow', async () => {
      const settings = {
        ...mockNotificationSettings,
        taskAssigned: false,
      };

      prismaService.notificationSettings.findUnique.mockResolvedValue(settings);

      const result = await service.createNotification(
        'user-1',
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a new task',
      );

      expect(result).toBeNull();
      expect(prismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should send email notification when enabled', async () => {
      prismaService.notificationSettings.findUnique
        .mockResolvedValueOnce(mockNotificationSettings) // For shouldNotifyUser
        .mockResolvedValueOnce(mockNotificationSettings); // For sendEmailNotification
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      emailService.sendEmail.mockResolvedValue(true);
      configService.get.mockReturnValue('http://localhost:3000');

      await service.createNotification(
        'user-1',
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a new task',
      );

      // Wait for async email to be sent
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('should not send email when email notifications disabled', async () => {
      const settings = {
        ...mockNotificationSettings,
        emailEnabled: false,
      };

      prismaService.notificationSettings.findUnique
        .mockResolvedValueOnce(mockNotificationSettings) // For shouldNotifyUser
        .mockResolvedValueOnce(settings); // For sendEmailNotification
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await service.createNotification(
        'user-1',
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a new task',
      );

      // Wait for async email check
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('createNotificationsForUsers', () => {
    it('should create notifications for multiple users', async () => {
      prismaService.notificationSettings.findUnique.mockResolvedValue(mockNotificationSettings);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      emailService.sendEmail.mockResolvedValue(true);
      configService.get.mockReturnValue('http://localhost:3000');

      const result = await service.createNotificationsForUsers(
        ['user-1', 'user-2'],
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a new task',
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(prismaService.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should filter out users who have disabled notifications', async () => {
      const settingsDisabled = {
        ...mockNotificationSettings,
        taskAssigned: false,
      };

      prismaService.notificationSettings.findUnique
        .mockResolvedValueOnce(mockNotificationSettings) // user-1 allows
        .mockResolvedValueOnce(settingsDisabled); // user-2 disallows

      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      emailService.sendEmail.mockResolvedValue(true);
      configService.get.mockReturnValue('http://localhost:3000');

      const result = await service.createNotificationsForUsers(
        ['user-1', 'user-2'],
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a new task',
      );

      expect(result.length).toBe(1);
      expect(prismaService.notification.create).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no users want notifications', async () => {
      const settingsDisabled = {
        ...mockNotificationSettings,
        taskAssigned: false,
      };

      prismaService.notificationSettings.findUnique.mockResolvedValue(settingsDisabled);

      const result = await service.createNotificationsForUsers(
        ['user-1', 'user-2'],
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a new task',
      );

      expect(result).toEqual([]);
      expect(prismaService.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('email notification with templates', () => {
    it('should use template when available for MENTIONED_IN_ACTIVITY', async () => {
      const mockActivity = {
        id: 'activity-1',
        subject: 'Test Activity',
        body: 'Activity body',
        activityDate: new Date(),
        createdBy: {
          id: 'creator-1',
          firstName: 'Jane',
          lastName: 'Creator',
        },
        activityType: {
          name: 'Call',
        },
        customer: null,
        lead: null,
        opportunity: null,
        candidate: null,
        employee: null,
        task: null,
      };

      prismaService.notificationSettings.findUnique
        .mockResolvedValueOnce(mockNotificationSettings) // For shouldNotifyUser
        .mockResolvedValueOnce(mockNotificationSettings); // For sendEmailNotification
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.activity.findUnique
        .mockResolvedValueOnce(mockActivity) // For buildTemplateData
        .mockResolvedValueOnce(mockActivity); // For generateEntityLink
      templatesService.renderDefault.mockResolvedValue({
        html: '<p>Template HTML</p>',
        text: 'Template text',
      });
      emailService.sendEmail.mockResolvedValue(true);
      configService.get.mockReturnValue('http://localhost:3000');

      await service.createNotification(
        'user-1',
        NotificationType.MENTIONED_IN_ACTIVITY,
        'You were mentioned',
        'You were mentioned in an activity',
        'activity',
        'activity-1',
      );

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(templatesService.renderDefault).toHaveBeenCalledWith(
        TemplateType.MENTION_NOTIFICATION,
        expect.objectContaining({
          firstName: 'John',
          mentionedBy: expect.objectContaining({
            firstName: 'Jane',
          }),
        }),
      );
    });

    it('should use template for TASK_ASSIGNED', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Task description',
        dueDate: new Date(),
        priority: 'HIGH',
        createdBy: {
          firstName: 'Jane',
          lastName: 'Creator',
        },
      };

      prismaService.notificationSettings.findUnique
        .mockResolvedValueOnce(mockNotificationSettings)
        .mockResolvedValueOnce(mockNotificationSettings);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.task.findUnique.mockResolvedValue(mockTask);
      templatesService.renderDefault.mockResolvedValue({
        html: '<p>Task template</p>',
        text: 'Task text',
      });
      emailService.sendEmail.mockResolvedValue(true);
      configService.get.mockReturnValue('http://localhost:3000');

      await service.createNotification(
        'user-1',
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a task',
        'task',
        'task-1',
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(templatesService.renderDefault).toHaveBeenCalledWith(
        TemplateType.TASK_ASSIGNED,
        expect.objectContaining({
          task: expect.objectContaining({
            title: 'Test Task',
          }),
        }),
      );
    });

    it('should fallback to default HTML when template rendering fails', async () => {
      prismaService.notificationSettings.findUnique
        .mockResolvedValueOnce(mockNotificationSettings)
        .mockResolvedValueOnce(mockNotificationSettings);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      templatesService.renderDefault.mockRejectedValue(new Error('Template error'));
      emailService.sendEmail.mockResolvedValue(true);
      configService.get.mockReturnValue('http://localhost:3000');

      await service.createNotification(
        'user-1',
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a task',
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('<p>'),
        }),
      );
    });
  });

  describe('entity link generation', () => {
    it('should generate link for activity with customer', async () => {
      const mockActivity = {
        id: 'activity-1',
        customerId: 'customer-1',
        leadId: null,
        opportunityId: null,
        candidateId: null,
        employeeId: null,
        contactId: null,
        taskId: null,
      };

      prismaService.notificationSettings.findUnique
        .mockResolvedValueOnce(mockNotificationSettings)
        .mockResolvedValueOnce(mockNotificationSettings);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.activity.findUnique.mockResolvedValue(mockActivity);
      emailService.sendEmail.mockResolvedValue(true);
      configService.get.mockReturnValue('http://localhost:3000');

      await service.createNotification(
        'user-1',
        NotificationType.MENTIONED_IN_ACTIVITY,
        'You were mentioned',
        'You were mentioned',
        'activity',
        'activity-1',
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('http://localhost:3000/crm/customers/customer-1'),
        }),
      );
    });

    it('should generate link for task entity', async () => {
      prismaService.notificationSettings.findUnique
        .mockResolvedValueOnce(mockNotificationSettings)
        .mockResolvedValueOnce(mockNotificationSettings);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      emailService.sendEmail.mockResolvedValue(true);
      configService.get.mockReturnValue('http://localhost:3000');

      await service.createNotification(
        'user-1',
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a task',
        'task',
        'task-1',
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('http://localhost:3000/tasks'),
        }),
      );
    });

    it('should not generate link when FRONTEND_URL not configured', async () => {
      prismaService.notificationSettings.findUnique
        .mockResolvedValueOnce(mockNotificationSettings)
        .mockResolvedValueOnce(mockNotificationSettings);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      emailService.sendEmail.mockResolvedValue(true);
      configService.get.mockReturnValue(null);

      await service.createNotification(
        'user-1',
        NotificationType.TASK_ASSIGNED,
        'Task Assigned',
        'You have been assigned a task',
        'task',
        'task-1',
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(emailService.sendEmail).toHaveBeenCalled();
    });
  });
});

