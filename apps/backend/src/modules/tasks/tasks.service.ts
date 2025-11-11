import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (filters.assignedToId) {
      where.assignedToId = filters.assignedToId;
    }

    if (filters.createdById) {
      where.createdById = filters.createdById;
    }

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.search) {
      where.OR = [
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
      ];
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
    const [creator, assignee, customerExists] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: createTaskDto.createdById },
        select: { id: true },
      }),
      createTaskDto.assignedToId
        ? this.prisma.user.findUnique({
            where: { id: createTaskDto.assignedToId },
            select: { id: true },
          })
        : Promise.resolve(null),
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

    if (createTaskDto.assignedToId && !assignee) {
      throw new NotFoundException(
        `Assignee with ID ${createTaskDto.assignedToId} not found`,
      );
    }

    if (createTaskDto.customerId && !customerExists) {
      throw new NotFoundException(
        `Customer with ID ${createTaskDto.customerId} not found`,
      );
    }

    const data: Prisma.TaskUncheckedCreateInput = {
      title: createTaskDto.title,
      description: createTaskDto.description ?? null,
      status: createTaskDto.status ?? TaskStatus.TODO,
      priority: createTaskDto.priority ?? TaskPriority.MEDIUM,
      assignedToId: createTaskDto.assignedToId ?? null,
      createdById: createTaskDto.createdById,
      customerId: createTaskDto.customerId ?? null,
      tags: createTaskDto.tags ?? [],
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

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    if (
      updateTaskDto.assignedToId &&
      !(await this.prisma.user.findUnique({
        where: { id: updateTaskDto.assignedToId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException(
        `Assignee with ID ${updateTaskDto.assignedToId} not found`,
      );
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

    if (updateTaskDto.assignedToId !== undefined) {
      data.assignedToId = updateTaskDto.assignedToId ?? null;
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

    const isOwner =
      task.createdById === userId || task.assignedToId === userId;
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

        const alreadyExists = currentTasks.some((item) => {
          if (item && typeof item === 'object' && 'ticket' in item) {
            try {
              const parsed = item as Record<string, unknown>;
              return parsed.ticket === task.id;
            } catch {
              return false;
            }
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

        currentTasks.push(eodEntry);

        const updateResult = await this.prisma.eodReport.updateMany({
          where: {
            id: currentReport.id,
            updatedAt: currentReport.updatedAt,
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
}


