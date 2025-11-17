import { Prisma } from '@prisma/client';

export const ACTIVITY_SUMMARY_INCLUDE = {
  activityType: true,
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
    },
  },
} as const;

type ActivityWithRelations = Prisma.ActivityGetPayload<{
  include: typeof ACTIVITY_SUMMARY_INCLUDE;
}>;

export const mapActivitySummary = (activity: ActivityWithRelations) => {
  const metadata =
    activity.metadata && typeof activity.metadata === 'object'
      ? (activity.metadata as Record<string, unknown>)
      : null;

  return {
    id: activity.id,
    activityTypeId: activity.activityTypeId,
    type: activity.activityType?.key ?? 'CUSTOM',
    typeLabel: activity.activityType?.name ?? 'Custom',
    typeColor: activity.activityType?.color ?? null,
    subject: activity.subject,
    title: activity.subject, // backwards compatibility
    body: activity.body ?? null,
    description: activity.body ?? null,
    activityDate: activity.activityDate ? activity.activityDate.toISOString() : null,
    reminderAt: activity.reminderAt ? activity.reminderAt.toISOString() : null,
    isReminderSent: activity.isReminderSent,
    isPinned: activity.isPinned,
    isCompleted: activity.isCompleted,
    visibility: activity.visibility,
    metadata,
    // Include entity IDs for navigation
    customerId: activity.customerId ?? null,
    leadId: activity.leadId ?? null,
    opportunityId: activity.opportunityId ?? null,
    candidateId: activity.candidateId ?? null,
    employeeId: activity.employeeId ?? null,
    contactId: activity.contactId ?? null,
    taskId: activity.taskId ?? null,
    assignedToId: activity.assignedToId ?? null,
    createdById: activity.createdById,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
    createdBy: {
      id: activity.createdBy.id,
      firstName: activity.createdBy.firstName,
      lastName: activity.createdBy.lastName,
      email: activity.createdBy.email,
      avatar: activity.createdBy.avatar ?? null,
    },
    assignedTo: activity.assignedTo
      ? {
          id: activity.assignedTo.id,
          firstName: activity.assignedTo.firstName,
          lastName: activity.assignedTo.lastName,
          email: activity.assignedTo.email,
          avatar: activity.assignedTo.avatar ?? null,
        }
      : null,
    activityType: activity.activityType
      ? {
          id: activity.activityType.id,
          key: activity.activityType.key,
          name: activity.activityType.name,
          description: activity.activityType.description,
          color: activity.activityType.color,
          icon: activity.activityType.icon,
          isActive: activity.activityType.isActive,
          isSystem: activity.activityType.isSystem,
          order: activity.activityType.order,
          createdAt: activity.activityType.createdAt.toISOString(),
          updatedAt: activity.activityType.updatedAt.toISOString(),
        }
      : undefined,
  };
};


