import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, NotificationType, TaskPriority, TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { LogTimeDto } from './dto/log-time.dto';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { extractMentionIdentifiers } from '../../common/utils/mention-parser';
import { TasksSchedulerService } from './tasks-scheduler.service';
import { startOfDay } from 'date-fns';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly tasksSchedulerService: TasksSchedulerService,
  ) {}

  private readonly taskInclude = {
    assignedTo: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    },
    assignees: {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    },
    createdBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    },
  } as const;

  private static formatTask(task: any) {
    if (!task) {
      return task;
    }

    return {
      ...task,
      estimatedHours:
        task.estimatedHours !== undefined && task.estimatedHours !== null
          ? Number(task.estimatedHours)
          : null,
      actualHours:
        task.actualHours !== undefined && task.actualHours !== null
          ? Number(task.actualHours)
          : null,
    };
  }

  private buildWhereClause(filters: FilterTasksDto): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    // Build assignment filter - check both legacy assignedToId and new assignees relation
    if (filters.assignedToId) {
      where.OR = [
        { assignedToId: filters.assignedToId },
        { assignees: { some: { userId: filters.assignedToId } } },
      ];
    }

    if (filters.search) {
      const searchCondition = {
        OR: [
          {
            title: {
              contains: filters.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            description: {
              contains: filters.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      };

      // If we already have an OR condition (from assignedToId), combine them with AND
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          searchCondition,
        ];
        delete where.OR;
      } else {
        where.OR = searchCondition.OR;
      }
    }

    if (filters.createdById) {
      where.createdById = filters.createdById;
    }

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.dueBefore || filters.dueAfter) {
      where.dueDate = {};

      if (filters.dueAfter) {
        (where.dueDate as Prisma.DateTimeNullableFilter).gte = new Date(
          filters.dueAfter,
        );
      }

      if (filters.dueBefore) {
        (where.dueDate as Prisma.DateTimeNullableFilter).lte = new Date(
          filters.dueBefore,
        );
      }
    }

    return where;
  }

  async create(createTaskDto: CreateTaskDto) {
    // Determine assignee IDs: prefer new array, fall back to legacy single assignee
    const assigneeIds = createTaskDto.assignedToIds?.length
      ? createTaskDto.assignedToIds
      : createTaskDto.assignedToId
        ? [createTaskDto.assignedToId]
        : [];

    const [creator, assignees, customerExists] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: createTaskDto.createdById },
        select: { id: true },
      }),
      assigneeIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
      createTaskDto.customerId
        ? this.prisma.customer.findUnique({
            where: { id: createTaskDto.customerId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!creator) {
      throw new NotFoundException(
        `User with ID ${createTaskDto.createdById} not found`,
      );
    }

    if (assigneeIds.length > 0 && assignees.length !== assigneeIds.length) {
      const foundIds = new Set(assignees.map((u) => u.id));
      const missingIds = assigneeIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Assignees with IDs ${missingIds.join(', ')} not found`,
      );
    }

    if (createTaskDto.customerId && !customerExists) {
      throw new NotFoundException(
        `Customer with ID ${createTaskDto.customerId} not found`,
      );
    }

    // Use first assignee for legacy assignedToId (for backward compatibility)
    const legacyAssignedToId = assigneeIds.length > 0 ? assigneeIds[0] : null;

    const data: Prisma.TaskUncheckedCreateInput = {
      title: createTaskDto.title,
      description: createTaskDto.description ?? null,
      status: createTaskDto.status ?? TaskStatus.TODO,
      priority: createTaskDto.priority ?? TaskPriority.MEDIUM,
      assignedToId: legacyAssignedToId, // Keep for backward compatibility
      createdById: createTaskDto.createdById,
      customerId: createTaskDto.customerId ?? null,
      tags: createTaskDto.tags ?? [],
      assignees: assigneeIds.length > 0
        ? {
            create: assigneeIds.map((userId) => ({ userId })),
          }
        : undefined,
    };

    if (createTaskDto.dueDate) {
      data.dueDate = new Date(createTaskDto.dueDate);
    }

    if (createTaskDto.startDate) {
      data.startDate = new Date(createTaskDto.startDate);
    }

    if (createTaskDto.estimatedHours !== undefined) {
      data.estimatedHours = new Prisma.Decimal(createTaskDto.estimatedHours);
    }

    if (createTaskDto.actualHours !== undefined) {
      data.actualHours = new Prisma.Decimal(createTaskDto.actualHours);
    }

    const task = await this.prisma.task.create({
      data,
      include: this.taskInclude,
    });

    // Process @mentions in title and description and create notifications
    // Don't await - let it run in background to not slow down task creation
    this.processMentions(task.id, createTaskDto.title, createTaskDto.description, createTaskDto.createdById).catch((error) => {
      console.error(`[Mentions] Failed to process mentions for task ${task.id}:`, error);
    });

    return TasksService.formatTask(task);
  }

  async findAll(filters: FilterTasksDto) {
    const where = this.buildWhereClause(filters);
    const take =
      filters.limit && Number.isFinite(filters.limit)
        ? Math.max(1, Math.min(filters.limit, 200))
        : undefined;

    const tasks = await this.prisma.task.findMany({
      where,
      include: this.taskInclude,
      orderBy: [
        {
          updatedAt: 'desc',
        },
      ],
      take,
    });

    const formatted = tasks.map((task) => TasksService.formatTask(task));

    const columns = Object.values(TaskStatus).map((status) => ({
      status,
      tasks: formatted.filter((task) => task.status === status),
    }));

    return {
      view: 'kanban',
      total: formatted.length,
      columns,
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: this.taskInclude,
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return TasksService.formatTask(task);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Determine assignee IDs: prefer new array, fall back to legacy single assignee
    const assigneeIds =
      updateTaskDto.assignedToIds !== undefined
        ? updateTaskDto.assignedToIds
        : updateTaskDto.assignedToId !== undefined
          ? updateTaskDto.assignedToId
            ? [updateTaskDto.assignedToId]
            : []
          : undefined; // undefined means don't change assignees

    // Validate assignees if provided
    if (assigneeIds !== undefined && assigneeIds.length > 0) {
      const assignees = await this.prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true },
      });
      if (assignees.length !== assigneeIds.length) {
        const foundIds = new Set(assignees.map((u) => u.id));
        const missingIds = assigneeIds.filter((id) => !foundIds.has(id));
        throw new NotFoundException(
          `Assignees with IDs ${missingIds.join(', ')} not found`,
        );
      }
    }

    if (
      updateTaskDto.customerId &&
      !(await this.prisma.customer.findUnique({
        where: { id: updateTaskDto.customerId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException(
        `Customer with ID ${updateTaskDto.customerId} not found`,
      );
    }

    const data: Prisma.TaskUncheckedUpdateInput = {};

    if (updateTaskDto.title !== undefined) {
      data.title = updateTaskDto.title;
    }

    if (updateTaskDto.description !== undefined) {
      data.description = updateTaskDto.description ?? null;
    }

    if (updateTaskDto.status !== undefined) {
      data.status = updateTaskDto.status;
    }

    if (updateTaskDto.priority !== undefined) {
      data.priority = updateTaskDto.priority;
    }

    // Handle assignee updates
    if (assigneeIds !== undefined) {
      // Update legacy assignedToId for backward compatibility
      data.assignedToId = assigneeIds.length > 0 ? assigneeIds[0] : null;

      // Update assignees relation
      data.assignees = {
        deleteMany: {}, // Remove all existing assignees
        create: assigneeIds.map((userId) => ({ userId })),
      };
    } else if (updateTaskDto.assignedToId !== undefined) {
      // Legacy update path - only update if assignedToIds not provided
      data.assignedToId = updateTaskDto.assignedToId ?? null;
      if (updateTaskDto.assignedToId) {
        // Also update assignees relation to include the single assignee
        data.assignees = {
          deleteMany: {},
          create: [{ userId: updateTaskDto.assignedToId }],
        };
      } else {
        // Remove all assignees
        data.assignees = {
          deleteMany: {},
        };
      }
    }

    if (updateTaskDto.customerId !== undefined) {
      data.customerId = updateTaskDto.customerId ?? null;
    }

    if (updateTaskDto.dueDate !== undefined) {
      data.dueDate = updateTaskDto.dueDate
        ? new Date(updateTaskDto.dueDate)
        : null;
    }

    if (updateTaskDto.startDate !== undefined) {
      data.startDate = updateTaskDto.startDate
        ? new Date(updateTaskDto.startDate)
        : null;
    }

    if (updateTaskDto.tags !== undefined) {
      data.tags = updateTaskDto.tags ?? [];
    }

    if (updateTaskDto.estimatedHours !== undefined) {
      data.estimatedHours = new Prisma.Decimal(updateTaskDto.estimatedHours);
    }

    if (updateTaskDto.actualHours !== undefined) {
      data.actualHours = new Prisma.Decimal(updateTaskDto.actualHours);
    }

    const task = await this.prisma.task.update({
      where: { id },
      data,
      include: this.taskInclude,
    });

    // Process @mentions if title or description was updated
    const title = updateTaskDto.title ?? existing.title;
    const description = updateTaskDto.description ?? existing.description;
    
    if (updateTaskDto.title !== undefined || updateTaskDto.description !== undefined) {
      // Use the current user (person updating) for mentions
      this.processMentions(id, title, description, userId).catch((error) => {
        console.error(`[Mentions] Failed to process mentions for task ${id}:`, error);
      });
    }

    return TasksService.formatTask(task);
  }

  async logTime(id: string, logTimeDto: LogTimeDto, userId: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Calculate new actual hours (add to existing)
    const currentActualHours =
      existing.actualHours !== null && existing.actualHours !== undefined
        ? Number(existing.actualHours)
        : 0;
    const newActualHours = currentActualHours + logTimeDto.hours;

    // Append to description
    const timestamp = new Date().toLocaleString();
    const timeEntry = `\n\n[${timestamp}] ${logTimeDto.hours}h - ${logTimeDto.description || 'No description provided'}`;
    const newDescription = existing.description
      ? existing.description + timeEntry
      : timeEntry.trim();

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        actualHours: new Prisma.Decimal(newActualHours),
        description: newDescription,
      },
      include: this.taskInclude,
    });

    // Process @mentions in the new description if it contains mentions
    // Use the current user's ID (person logging time) for mentions
    if (logTimeDto.description) {
      this.processMentions(id, existing.title, logTimeDto.description, userId).catch((error) => {
        console.error(`[Mentions] Failed to process mentions for task ${id} in logTime:`, error);
      });
    }

    return TasksService.formatTask(task);
  }

  async updateStatus(id: string, updateStatusDto: UpdateTaskStatusDto) {
    const existing = await this.prisma.task.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    const data: Prisma.TaskUncheckedUpdateInput = {
      status: updateStatusDto.status,
    };

    if (updateStatusDto.status === TaskStatus.DONE) {
      data.completedAt = updateStatusDto.completedAt
        ? new Date(updateStatusDto.completedAt)
        : new Date();
    } else if (existing.completedAt) {
      data.completedAt = null;
    }

    const task = await this.prisma.task.update({
      where: { id },
      data,
      include: this.taskInclude,
    });

    return TasksService.formatTask(task);
  }

  async addTaskToEodReport(taskId: string, userId: string, role: UserRole) {
    const taskRecord = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: this.taskInclude,
    });

    if (!taskRecord) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    const task = TasksService.formatTask(taskRecord);

    // Check if user is owner (creator) or assignee (legacy or new assignees)
    const isOwner =
      task.createdById === userId ||
      task.assignedToId === userId ||
      (task.assignees && task.assignees.some((ta: { userId: string }) => ta.userId === userId));
    const isPrivileged =
      role === UserRole.ADMIN ||
      role === UserRole.HR ||
      role === UserRole.ACCOUNT_MANAGER;

    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException(
        'You do not have permission to add this task to your EOD report',
      );
    }

    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    const reportDate = new Date(`${dateString}T00:00:00.000Z`);

    const defaultEntryLabel = `Task "${task.title}" added to your ${dateString} EOD report.`;

    const eodEntry: Prisma.JsonObject = {
      clientDetails: task.title,
      ticket: task.id,
      typeOfWorkDone: 'IMPLEMENTATION',
      taskLifecycle: 'NEW',
      taskStatus: task.status === TaskStatus.DONE ? 'DONE' : 'IN_PROGRESS',
      timeSpentOnTicket:
        task.actualHours !== undefined && task.actualHours !== null
          ? Number(task.actualHours)
          : 0,
    };

    if (task.estimatedHours !== undefined && task.estimatedHours !== null) {
      eodEntry.taskEstimatedTime = Number(task.estimatedHours);
    }

    const existingReport = await this.prisma.eodReport.findFirst({
      where: {
        userId,
        date: reportDate,
      },
      select: {
        id: true,
        tasksWorkedOn: true,
        date: true,
        updatedAt: true,
        submittedAt: true,
      },
    });

    if (existingReport) {
      let currentReport = existingReport;
      let attempts = 0;

      while (attempts < 3) {
        attempts += 1;

        const reportDateString = currentReport.date
          ? currentReport.date.toISOString().split('T')[0]
          : dateString;

        if (currentReport.submittedAt) {
          throw new BadRequestException(
            `The EOD report for ${reportDateString} has already been submitted.`,
          );
        }

        const currentTasks: Prisma.JsonArray = Array.isArray(
          currentReport.tasksWorkedOn,
        )
          ? [...(currentReport.tasksWorkedOn as Prisma.JsonArray)]
          : [];

        // Check if this specific task is already in the report
        const alreadyExists = currentTasks.some((item) => {
          if (!item) {
            return false;
          }
          
          // Handle object format (new format with ticket field)
          if (typeof item === 'object' && item !== null && 'ticket' in item) {
            try {
              const parsed = item as Record<string, unknown>;
              const ticketValue = parsed.ticket;
              // Compare as strings to handle any type mismatches
              return String(ticketValue) === String(task.id);
            } catch {
              return false;
            }
          }
          
          // Handle string format (legacy format - task ID as string)
          if (typeof item === 'string') {
            return String(item) === String(task.id);
          }
          
          return false;
        });

        if (alreadyExists) {
          return {
            reportId: currentReport.id,
            reportDate: reportDateString,
            isNewReport: false,
            message: `Task "${task.title}" is already part of your EOD report for ${reportDateString}.`,
          };
        }

        // Add the new task entry
        currentTasks.push(eodEntry);

        // Update the report with optimistic locking to prevent concurrent update issues
        const updateResult = await this.prisma.eodReport.updateMany({
          where: {
            id: currentReport.id,
            updatedAt: currentReport.updatedAt, // Optimistic locking
          },
          data: {
            tasksWorkedOn: currentTasks as Prisma.InputJsonValue,
          },
        });

        if (updateResult.count > 0) {
          return {
            reportId: currentReport.id,
            reportDate: reportDateString,
            isNewReport: false,
            message: `Task "${task.title}" added to your ${reportDateString} EOD report.`,
          };
        }

        // If update failed (likely due to concurrent modification), refresh and retry

        const refreshedReport = await this.prisma.eodReport.findUnique({
          where: { id: currentReport.id },
          select: {
            id: true,
            tasksWorkedOn: true,
            date: true,
            updatedAt: true,
            submittedAt: true,
          },
        });

        if (!refreshedReport) {
          break;
        }

        currentReport = refreshedReport;
      }

      throw new BadRequestException(
        'Unable to add the task to your EOD report due to a concurrent update. Please try again.',
      );
    }

    const createdReport = await this.prisma.eodReport.create({
      data: {
        userId,
        date: reportDate,
        summary: `Auto-generated report for ${dateString}. Please update with additional details.`,
        tasksWorkedOn: [eodEntry],
      },
      select: {
        id: true,
        date: true,
      },
    });

    return {
      reportId: createdReport.id,
      reportDate: createdReport.date
        ? createdReport.date.toISOString().split('T')[0]
        : dateString,
      isNewReport: true,
      message: `${defaultEntryLabel} A new draft report was created for you.`,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    await this.prisma.task.delete({
      where: { id },
    });

    return { deleted: true };
  }

  /**
   * Process @mentions in task title and description and create notifications
   */
  private async processMentions(
    taskId: string,
    title: string | null | undefined,
    description: string | null | undefined,
    createdById: string,
  ) {
    try {
      // Combine title and description to extract all mentions
      const text = [title, description].filter(Boolean).join(' ');
      if (!text) {
        return;
      }

      // Extract mention identifiers
      const identifiers = extractMentionIdentifiers(text);
      if (identifiers.length === 0) {
        return;
      }

      console.log(`[Mentions] Processing mentions for task ${taskId}:`, {
        identifiers,
        textPreview: text.substring(0, 100),
      });

      // Find users by mentions
      const mentionedUserIds = await this.usersService.findUsersByMentions(identifiers);
      
      console.log(`[Mentions] Found ${mentionedUserIds.length} users for mentions:`, mentionedUserIds);
      
      // Remove the creator from mentioned users (they don't need to be notified about their own mentions)
      const userIdsToNotify = mentionedUserIds.filter((id) => id !== createdById);
      
      if (userIdsToNotify.length === 0) {
        console.log(`[Mentions] No users to notify (all mentions were by creator or no matches found)`);
        return;
      }

      // Get creator info for notification message
      const creator = await this.prisma.user.findUnique({
        where: { id: createdById },
        select: { firstName: true, lastName: true, email: true },
      });

      const creatorName = creator
        ? `${creator.firstName} ${creator.lastName}`.trim() || creator.email
        : 'Someone';

      // Create notifications for mentioned users
      const titlePreview = title ? (title.length > 50 ? title.substring(0, 50) + '...' : title) : 'a task';
      
      const notifications = await this.notificationsService.createNotificationsForUsers(
        userIdsToNotify,
        NotificationType.MENTIONED_IN_ACTIVITY,
        `You were mentioned in a task`,
        `${creatorName} mentioned you in task "${titlePreview}"`,
        'task',
        taskId,
      );

      console.log(`[Mentions] Created ${notifications.length} notifications for task ${taskId}`);
    } catch (error) {
      // Log error but don't fail the task creation/update
      console.error(`[Mentions] Error processing mentions for task ${taskId}:`, error);
    }
  }

  // ============================================
  // Task Template (Recurring Tasks) Methods
  // ============================================

  async createTemplate(createTemplateDto: CreateTaskTemplateDto) {
    // Validate creator exists
    const creator = await this.prisma.user.findUnique({
      where: { id: createTemplateDto.createdById },
      select: { id: true },
    });

    if (!creator) {
      throw new NotFoundException(
        `User with ID ${createTemplateDto.createdById} not found`,
      );
    }

    // Validate assignees if provided
    if (createTemplateDto.defaultAssigneeIds && createTemplateDto.defaultAssigneeIds.length > 0) {
      const assignees = await this.prisma.user.findMany({
        where: { id: { in: createTemplateDto.defaultAssigneeIds } },
        select: { id: true },
      });
      if (assignees.length !== createTemplateDto.defaultAssigneeIds.length) {
        const foundIds = new Set(assignees.map((u) => u.id));
        const missingIds = createTemplateDto.defaultAssigneeIds.filter((id) => !foundIds.has(id));
        throw new NotFoundException(
          `Assignees with IDs ${missingIds.join(', ')} not found`,
        );
      }
    }

    // Validate customer if provided
    if (createTemplateDto.defaultCustomerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: createTemplateDto.defaultCustomerId },
        select: { id: true },
      });
      if (!customer) {
        throw new NotFoundException(
          `Customer with ID ${createTemplateDto.defaultCustomerId} not found`,
        );
      }
    }

    const data: Prisma.TaskTemplateUncheckedCreateInput = {
      title: createTemplateDto.title,
      description: createTemplateDto.description ?? null,
      status: createTemplateDto.status ?? TaskStatus.TODO,
      priority: createTemplateDto.priority ?? TaskPriority.MEDIUM,
      recurrenceType: createTemplateDto.recurrenceType as any,
      recurrenceInterval: createTemplateDto.recurrenceInterval ?? 1,
      isActive: createTemplateDto.isActive ?? true,
      startDate: new Date(createTemplateDto.startDate),
      endDate: createTemplateDto.endDate ? new Date(createTemplateDto.endDate) : null,
      defaultAssigneeIds: createTemplateDto.defaultAssigneeIds ?? [],
      defaultCustomerId: createTemplateDto.defaultCustomerId ?? null,
      defaultTags: createTemplateDto.defaultTags ?? [],
      defaultEstimatedHours: createTemplateDto.defaultEstimatedHours
        ? new Prisma.Decimal(createTemplateDto.defaultEstimatedHours)
        : null,
      createdById: createTemplateDto.createdById,
    };

    const template = await this.prisma.taskTemplate.create({
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // If template is active and startDate is today or in the past, generate task immediately for today
    const today = startOfDay(new Date());
    const startDate = startOfDay(template.startDate);
    const shouldGenerateImmediately = template.isActive && startDate.getTime() <= today.getTime();
    
    if (shouldGenerateImmediately) {
      console.log(`[TasksService] Attempting immediate task generation for template ${template.id}, startDate: ${startDate.toISOString()}, today: ${today.toISOString()}`);
      // Generate task asynchronously (don't wait for it to complete)
      // This will check if today matches the recurrence pattern and generate if it does
      this.tasksSchedulerService.generateTaskForTemplateAndDate(
        template.id,
        today,
      ).then((generated) => {
        if (generated) {
          console.log(`[TasksService] Successfully generated immediate task for template ${template.id}`);
        } else {
          console.log(`[TasksService] Task generation skipped for template ${template.id} (doesn't match recurrence pattern)`);
        }
      }).catch((error) => {
        // Log error but don't fail the template creation
        console.error(`[TasksService] Failed to generate initial task for template ${template.id}:`, error);
      });
    } else {
      console.log(`[TasksService] Skipping immediate task generation for template ${template.id}, isActive: ${template.isActive}, startDate: ${startDate.toISOString()}, today: ${today.toISOString()}`);
    }

    return template;
  }

  async findAllTemplates() {
    const templates = await this.prisma.taskTemplate.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        _count: {
          select: {
            generatedTasks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return templates;
  }

  async findOneTemplate(id: string) {
    const template = await this.prisma.taskTemplate.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        generatedTasks: {
          take: 10,
          orderBy: {
            generatedForDate: 'desc',
          },
          include: {
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            generatedTasks: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Task template with ID ${id} not found`);
    }

    return template;
  }

  async updateTemplate(id: string, updateTemplateDto: UpdateTaskTemplateDto) {
    const existing = await this.prisma.taskTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Task template with ID ${id} not found`);
    }

    // Validate assignees if provided
    if (updateTemplateDto.defaultAssigneeIds !== undefined) {
      if (updateTemplateDto.defaultAssigneeIds.length > 0) {
        const assignees = await this.prisma.user.findMany({
          where: { id: { in: updateTemplateDto.defaultAssigneeIds } },
          select: { id: true },
        });
        if (assignees.length !== updateTemplateDto.defaultAssigneeIds.length) {
          const foundIds = new Set(assignees.map((u) => u.id));
          const missingIds = updateTemplateDto.defaultAssigneeIds.filter((id) => !foundIds.has(id));
          throw new NotFoundException(
            `Assignees with IDs ${missingIds.join(', ')} not found`,
          );
        }
      }
    }

    // Validate customer if provided
    if (updateTemplateDto.defaultCustomerId !== undefined && updateTemplateDto.defaultCustomerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: updateTemplateDto.defaultCustomerId },
        select: { id: true },
      });
      if (!customer) {
        throw new NotFoundException(
          `Customer with ID ${updateTemplateDto.defaultCustomerId} not found`,
        );
      }
    }

    const data: Prisma.TaskTemplateUncheckedUpdateInput = {};

    if (updateTemplateDto.title !== undefined) {
      data.title = updateTemplateDto.title;
    }
    if (updateTemplateDto.description !== undefined) {
      data.description = updateTemplateDto.description ?? null;
    }
    if (updateTemplateDto.status !== undefined) {
      data.status = updateTemplateDto.status;
    }
    if (updateTemplateDto.priority !== undefined) {
      data.priority = updateTemplateDto.priority;
    }
    if (updateTemplateDto.recurrenceType !== undefined) {
      data.recurrenceType = updateTemplateDto.recurrenceType as any;
    }
    if (updateTemplateDto.recurrenceInterval !== undefined) {
      data.recurrenceInterval = updateTemplateDto.recurrenceInterval;
    }
    if (updateTemplateDto.isActive !== undefined) {
      data.isActive = updateTemplateDto.isActive;
    }
    if (updateTemplateDto.startDate !== undefined) {
      data.startDate = new Date(updateTemplateDto.startDate);
    }
    if (updateTemplateDto.endDate !== undefined) {
      data.endDate = updateTemplateDto.endDate ? new Date(updateTemplateDto.endDate) : null;
    }
    if (updateTemplateDto.defaultAssigneeIds !== undefined) {
      data.defaultAssigneeIds = updateTemplateDto.defaultAssigneeIds;
    }
    if (updateTemplateDto.defaultCustomerId !== undefined) {
      data.defaultCustomerId = updateTemplateDto.defaultCustomerId ?? null;
    }
    if (updateTemplateDto.defaultTags !== undefined) {
      data.defaultTags = updateTemplateDto.defaultTags;
    }
    if (updateTemplateDto.defaultEstimatedHours !== undefined) {
      data.defaultEstimatedHours = updateTemplateDto.defaultEstimatedHours
        ? new Prisma.Decimal(updateTemplateDto.defaultEstimatedHours)
        : null;
    }

    // Get the final values after update to check if we should generate a task
    const finalIsActive = updateTemplateDto.isActive !== undefined 
      ? updateTemplateDto.isActive 
      : existing.isActive;
    const finalStartDate = updateTemplateDto.startDate !== undefined
      ? new Date(updateTemplateDto.startDate)
      : existing.startDate;

    const template = await this.prisma.taskTemplate.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // If template was activated or startDate was changed to today or past, generate task immediately for today
    const wasActivated = updateTemplateDto.isActive === true && !existing.isActive;
    const startDateChangedToTodayOrPast = updateTemplateDto.startDate !== undefined &&
      startOfDay(finalStartDate).getTime() <= startOfDay(new Date()).getTime() &&
      startOfDay(existing.startDate).getTime() > startOfDay(new Date()).getTime();

    if (finalIsActive && 
        (wasActivated || startDateChangedToTodayOrPast) &&
        startOfDay(finalStartDate).getTime() <= startOfDay(new Date()).getTime()) {
      const today = startOfDay(new Date());
      // Generate task asynchronously (don't wait for it to complete)
      // This will check if today matches the recurrence pattern and generate if it does
      this.tasksSchedulerService.generateTaskForTemplateAndDate(
        template.id,
        today,
      ).catch((error) => {
        // Log error but don't fail the template update
        console.error(`Failed to generate initial task for template ${template.id}:`, error);
      });
    }

    return template;
  }

  async removeTemplate(id: string) {
    const template = await this.prisma.taskTemplate.findUnique({ where: { id } });

    if (!template) {
      throw new NotFoundException(`Task template with ID ${id} not found`);
    }

    await this.prisma.taskTemplate.delete({ where: { id } });

    return { message: 'Task template deleted successfully' };
  }
}


