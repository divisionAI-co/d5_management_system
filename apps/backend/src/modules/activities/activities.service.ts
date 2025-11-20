import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ActivityVisibility, NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { FilterActivitiesDto } from './dto/filter-activities.dto';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';
import { ACTIVITY_SUMMARY_INCLUDE, mapActivitySummary } from './activity.mapper';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { extractMentionIdentifiers } from '../../common/utils/mention-parser';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async create(createActivityDto: CreateActivityDto, createdById: string) {
    const { activityTypeId, targets, metadata, isCompleted, notifyAssignee, ...rest } =
      createActivityDto;

    if (!rest.subject || !rest.subject.trim()) {
      throw new BadRequestException('Subject is required');
    }

    await this.ensureActivityType(activityTypeId);
    await this.ensureTargetsExist(targets);

    const data: Prisma.ActivityCreateInput = {
      activityType: { connect: { id: activityTypeId } },
      subject: rest.subject.trim(),
      body: rest.body?.trim(),
      activityDate: rest.activityDate ? new Date(rest.activityDate) : undefined,
      reminderAt: rest.reminderAt ? new Date(rest.reminderAt) : undefined,
      isCompleted: Boolean(isCompleted),
      visibility: rest.visibility ?? ActivityVisibility.PUBLIC,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      isPinned: false,
      createdBy: { connect: { id: createdById } },
      assignedTo: rest.assignedToId ? { connect: { id: rest.assignedToId } } : undefined,
      customer: targets.customerId ? { connect: { id: targets.customerId } } : undefined,
      lead: targets.leadId ? { connect: { id: targets.leadId } } : undefined,
      opportunity: targets.opportunityId ? { connect: { id: targets.opportunityId } } : undefined,
      candidate: targets.candidateId ? { connect: { id: targets.candidateId } } : undefined,
      employee: targets.employeeId ? { connect: { id: targets.employeeId } } : undefined,
      contact: targets.contactId ? { connect: { id: targets.contactId } } : undefined,
      task: targets.taskId ? { connect: { id: targets.taskId } } : undefined,
      quote: targets.quoteId ? { connect: { id: targets.quoteId } } : undefined,
    };

    const activity = await this.prisma.activity.create({
      data,
      include: ACTIVITY_SUMMARY_INCLUDE,
    });

    // Process @mentions and create notifications
    // Don't await - let it run in background to not slow down activity creation
    this.processMentions(activity.id, rest.subject, rest.body, createdById).catch((error) => {
      console.error(`[Mentions] Failed to process mentions for activity ${activity.id}:`, error);
    });

    // TODO: Queue reminder/notification jobs when background workers are available
    void notifyAssignee;

    return mapActivitySummary(activity as any);
  }

  async findAll(filters: FilterActivitiesDto) {
    const where = await this.buildWhereClause(filters);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const orderBy = {
      [filters.sortBy ?? 'createdAt']: filters.sortOrder ?? 'desc',
    } as Prisma.ActivityOrderByWithRelationInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: ACTIVITY_SUMMARY_INCLUDE,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      data: items.map((item) => mapActivitySummary(item as any)),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: ACTIVITY_SUMMARY_INCLUDE,
    });

    if (!activity) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }

    return mapActivitySummary(activity as any);
  }

  async update(id: string, updateActivityDto: UpdateActivityDto) {
    const existing = await this.findOne(id);

    if (updateActivityDto.activityTypeId) {
      await this.ensureActivityType(updateActivityDto.activityTypeId);
    }

    if (updateActivityDto.targets) {
      await this.ensureTargetsExist(updateActivityDto.targets, true);
    }

    const trimmedSubject =
      updateActivityDto.subject !== undefined ? updateActivityDto.subject.trim() : undefined;

    if (trimmedSubject !== undefined && !trimmedSubject) {
      throw new BadRequestException('Subject cannot be empty');
    }

    const data: Prisma.ActivityUpdateInput = {
      ...(updateActivityDto.activityTypeId && {
        activityType: { connect: { id: updateActivityDto.activityTypeId } },
      }),
      ...(trimmedSubject !== undefined && {
        subject: { set: trimmedSubject },
      }),
      ...(updateActivityDto.body !== undefined && {
        body: { set: updateActivityDto.body ? updateActivityDto.body.trim() : null },
      }),
      ...(updateActivityDto.activityDate !== undefined && {
        activityDate: {
          set: updateActivityDto.activityDate ? new Date(updateActivityDto.activityDate) : null,
        },
      }),
      ...(updateActivityDto.reminderAt !== undefined && {
        reminderAt: {
          set: updateActivityDto.reminderAt ? new Date(updateActivityDto.reminderAt) : null,
        },
        isReminderSent: { set: false },
      }),
      ...(updateActivityDto.isPinned !== undefined && {
        isPinned: { set: updateActivityDto.isPinned },
      }),
      ...(updateActivityDto.isCompleted !== undefined && {
        isCompleted: { set: updateActivityDto.isCompleted },
      }),
      ...(updateActivityDto.assignedToId !== undefined && {
        assignedTo: updateActivityDto.assignedToId
          ? { connect: { id: updateActivityDto.assignedToId } }
          : { disconnect: true },
      }),
      ...(updateActivityDto.visibility !== undefined && {
        visibility: { set: updateActivityDto.visibility },
      }),
      ...(updateActivityDto.metadata !== undefined && {
        metadata:
          updateActivityDto.metadata === null
            ? Prisma.JsonNull
            : (updateActivityDto.metadata as Prisma.InputJsonValue),
      }),
      ...(updateActivityDto.targets?.customerId !== undefined && {
        customer: updateActivityDto.targets.customerId
          ? { connect: { id: updateActivityDto.targets.customerId } }
          : { disconnect: true },
      }),
      ...(updateActivityDto.targets?.leadId !== undefined && {
        lead: updateActivityDto.targets.leadId
          ? { connect: { id: updateActivityDto.targets.leadId } }
          : { disconnect: true },
      }),
      ...(updateActivityDto.targets?.opportunityId !== undefined && {
        opportunity: updateActivityDto.targets.opportunityId
          ? { connect: { id: updateActivityDto.targets.opportunityId } }
          : { disconnect: true },
      }),
      ...(updateActivityDto.targets?.candidateId !== undefined && {
        candidate: updateActivityDto.targets.candidateId
          ? { connect: { id: updateActivityDto.targets.candidateId } }
          : { disconnect: true },
      }),
      ...(updateActivityDto.targets?.employeeId !== undefined && {
        employee: updateActivityDto.targets.employeeId
          ? { connect: { id: updateActivityDto.targets.employeeId } }
          : { disconnect: true },
      }),
      ...(updateActivityDto.targets?.contactId !== undefined && {
        contact: updateActivityDto.targets.contactId
          ? { connect: { id: updateActivityDto.targets.contactId } }
          : { disconnect: true },
      }),
      ...(updateActivityDto.targets?.taskId !== undefined && {
        task: updateActivityDto.targets.taskId
          ? { connect: { id: updateActivityDto.targets.taskId } }
          : { disconnect: true },
      }),
      ...(updateActivityDto.targets?.quoteId !== undefined && {
        quote: updateActivityDto.targets.quoteId
          ? { connect: { id: updateActivityDto.targets.quoteId } }
          : { disconnect: true },
      }),
    };

    const activity = await this.prisma.activity.update({
      where: { id: existing.id },
      data,
      include: ACTIVITY_SUMMARY_INCLUDE,
    });

    // Process @mentions if subject or body was updated
    if (updateActivityDto.subject !== undefined || updateActivityDto.body !== undefined) {
      const subject = updateActivityDto.subject ?? activity.subject;
      const body = updateActivityDto.body ?? activity.body;
      // Don't await - let it run in background to not slow down activity update
      this.processMentions(activity.id, subject, body, activity.createdById).catch((error) => {
        console.error(`[Mentions] Failed to process mentions for activity ${activity.id}:`, error);
      });
    }

    return activity;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.activity.delete({ where: { id } });
    return { id };
  }

  async togglePin(id: string, isPinned: boolean) {
    await this.findOne(id);
    const updated = await this.prisma.activity.update({
      where: { id },
      data: { isPinned: { set: isPinned } },
      include: ACTIVITY_SUMMARY_INCLUDE,
    });

    return mapActivitySummary(updated as any);
  }

  async complete(id: string, isCompleted: boolean) {
    await this.findOne(id);
    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        isCompleted: { set: isCompleted },
        ...(isCompleted
          ? {
              reminderAt: { set: null },
              isReminderSent: { set: false },
            }
          : {}),
      },
      include: ACTIVITY_SUMMARY_INCLUDE,
    });

    return mapActivitySummary(updated as any);
  }

  // Activity types management

  async listActivityTypes(includeInactive = false) {
    return this.prisma.activityType.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async createActivityType(dto: CreateActivityTypeDto, userId: string) {
    await this.ensureActivityTypeKeyAvailable(dto.key);

    return this.prisma.activityType.create({
      data: {
        name: dto.name.trim(),
        key: dto.key.trim().toUpperCase(),
        description: dto.description?.trim(),
        color: dto.color,
        icon: dto.icon,
        isActive: dto.isActive ?? true,
        order: dto.order ?? 0,
        createdBy: userId ? { connect: { id: userId } } : undefined,
      },
    });
  }

  async updateActivityType(id: string, dto: UpdateActivityTypeDto) {
    const existing = await this.prisma.activityType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Activity type with ID ${id} not found`);
    }

    if (existing.isSystem && dto.isActive === false) {
      throw new BadRequestException('System activity types cannot be deactivated');
    }

    if (dto.key && dto.key.trim().toUpperCase() !== existing.key) {
      await this.ensureActivityTypeKeyAvailable(dto.key.trim().toUpperCase());
    }

    return this.prisma.activityType.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        key: dto.key ? dto.key.trim().toUpperCase() : undefined,
        description: dto.description?.trim(),
        color: dto.color,
        icon: dto.icon,
        isActive: dto.isActive,
        order: dto.order,
      },
    });
  }

  async deleteActivityType(id: string) {
    const usage = await this.prisma.activity.count({ where: { activityTypeId: id } });
    if (usage > 0) {
      throw new BadRequestException('Cannot delete activity type that is in use');
    }

    await this.prisma.activityType.delete({ where: { id } });
    return { id };
  }

  private async ensureActivityType(id: string) {
    const exists = await this.prisma.activityType.findUnique({ where: { id } });
    if (!exists || !exists.isActive) {
      throw new BadRequestException('Invalid activity type selected');
    }
  }

  private async ensureActivityTypeKeyAvailable(key: string) {
    const exists = await this.prisma.activityType.findFirst({
      where: { key: key.trim().toUpperCase() },
    });
    if (exists) {
      throw new BadRequestException('Activity type key is already in use');
    }
  }

  private async ensureTargetsExist(
    targets: {
      customerId?: string | null;
      leadId?: string | null;
      opportunityId?: string | null;
      candidateId?: string | null;
      employeeId?: string | null;
      contactId?: string | null;
      taskId?: string | null;
      quoteId?: string | null;
    },
    allowEmpty = false,
  ) {
    const targetEntries: Array<{
      id?: string | null;
      label: string;
      lookup: keyof PrismaService;
    }> = [
      { id: targets.customerId, label: 'Customer', lookup: 'customer' },
      { id: targets.leadId, label: 'Lead', lookup: 'lead' },
      { id: targets.opportunityId, label: 'Opportunity', lookup: 'opportunity' },
      { id: targets.candidateId, label: 'Candidate', lookup: 'candidate' },
      { id: targets.employeeId, label: 'Employee', lookup: 'employee' },
      { id: targets.contactId, label: 'Contact', lookup: 'contact' },
      { id: targets.taskId, label: 'Task', lookup: 'task' },
      { id: targets.quoteId, label: 'Quote', lookup: 'quote' },
    ];

    const provided = targetEntries.filter((entry) => Boolean(entry.id));

    if (!allowEmpty && provided.length === 0) {
      throw new BadRequestException(
        'At least one target (customer, lead, opportunity, candidate, employee, contact, task, or quote) must be specified',
      );
    }

    await Promise.all(
      provided.map(async ({ id, label, lookup }) => {
        if (!id) return;
        const entity = await (this.prisma[lookup] as any).findUnique({ where: { id } });
        if (!entity) {
          throw new BadRequestException(`${label} with ID ${id} not found`);
        }
      }),
    );
  }

  private async buildWhereClause(filters: FilterActivitiesDto) {
    const where: Prisma.ActivityWhereInput = {};

    if (filters.search) {
      const searchTerm = filters.search.trim();
      if (searchTerm) {
        where.OR = [
          { subject: { contains: searchTerm, mode: 'insensitive' } },
          { body: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }
    }

    if (filters.activityTypeId) {
      where.activityTypeId = filters.activityTypeId;
    }

    if (filters.visibility) {
      where.visibility = filters.visibility;
    }

    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.leadId) where.leadId = filters.leadId;
    if (filters.opportunityId) where.opportunityId = filters.opportunityId;
    if (filters.candidateId) where.candidateId = filters.candidateId;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.taskId) where.taskId = filters.taskId;
    if (filters.quoteId) where.quoteId = filters.quoteId;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters.isPinned !== undefined) where.isPinned = filters.isPinned;
    if (filters.isCompleted !== undefined) where.isCompleted = filters.isCompleted;

    if (filters.activityDateFrom || filters.activityDateTo) {
      where.activityDate = {};
      if (filters.activityDateFrom) {
        where.activityDate.gte = new Date(filters.activityDateFrom);
      }
      if (filters.activityDateTo) {
        where.activityDate.lte = new Date(filters.activityDateTo);
      }
    }

    if (filters.createdFrom || filters.createdTo) {
      where.createdAt = {};
      if (filters.createdFrom) {
        where.createdAt.gte = new Date(filters.createdFrom);
      }
      if (filters.createdTo) {
        where.createdAt.lte = new Date(filters.createdTo);
      }
    }

    return where;
  }

  /**
   * Process @mentions in activity text and create notifications
   */
  private async processMentions(
    activityId: string,
    subject: string | null | undefined,
    body: string | null | undefined,
    createdById: string,
  ) {
    try {
      // Combine subject and body to extract all mentions
      const text = [subject, body].filter(Boolean).join(' ');
      if (!text) {
        return;
      }

      // Extract mention identifiers
      const identifiers = extractMentionIdentifiers(text);
      if (identifiers.length === 0) {
        return;
      }

      console.log(`[Mentions] Processing mentions for activity ${activityId}:`, {
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
      const subjectPreview = subject ? (subject.length > 50 ? subject.substring(0, 50) + '...' : subject) : 'an activity';
      
      const notifications = await this.notificationsService.createNotificationsForUsers(
        userIdsToNotify,
        NotificationType.MENTIONED_IN_ACTIVITY,
        `You were mentioned in an activity`,
        `${creatorName} mentioned you in "${subjectPreview}"`,
        'activity',
        activityId,
      );

      console.log(`[Mentions] Created ${notifications.length} notifications for activity ${activityId}`);
    } catch (error) {
      // Log error but don't fail the activity creation/update
      console.error(`[Mentions] Error processing mentions for activity ${activityId}:`, error);
    }
  }
}


