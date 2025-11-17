import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, NotificationType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecentNotifications(userId: string, limit = 20) {
    const safeLimit = Math.max(1, Math.min(limit, 50));

    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: Prisma.SortOrder.desc },
      take: safeLimit,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Check if user has notification preference enabled for a specific type
   */
  async shouldNotifyUser(userId: string, notificationType: NotificationType): Promise<boolean> {
    const settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.inAppEnabled) {
      return false;
    }

    // Check type-specific preference
    switch (notificationType) {
      case NotificationType.TASK_ASSIGNED:
        return settings.taskAssigned;
      case NotificationType.TASK_DUE_SOON:
        return settings.taskDueSoon;
      case NotificationType.LEAVE_APPROVED:
        return settings.leaveApproved;
      case NotificationType.PERFORMANCE_REVIEW:
        return settings.performanceReview;
      case NotificationType.NEW_CANDIDATE:
        return settings.newCandidate;
      case NotificationType.NEW_OPPORTUNITY:
        return settings.newOpportunity;
      case NotificationType.MENTIONED_IN_ACTIVITY:
        return settings.mentionedInActivity;
      default:
        return true; // Default to enabled for other types
    }
  }

  /**
   * Create a notification for a user
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    entityType?: string,
    entityId?: string,
  ) {
    // Check if user wants this type of notification
    const shouldNotify = await this.shouldNotifyUser(userId, type);
    if (!shouldNotify) {
      return null;
    }

    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        entityType,
        entityId,
      },
    });
  }

  /**
   * Create notifications for multiple users
   */
  async createNotificationsForUsers(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    entityType?: string,
    entityId?: string,
  ) {
    // Filter users who want this notification type
    const usersToNotify: string[] = [];
    for (const userId of userIds) {
      const shouldNotify = await this.shouldNotifyUser(userId, type);
      if (shouldNotify) {
        usersToNotify.push(userId);
      }
    }

    if (usersToNotify.length === 0) {
      return [];
    }

    // Create notifications in batch
    const notifications = await Promise.all(
      usersToNotify.map((userId) =>
        this.prisma.notification.create({
          data: {
            userId,
            type,
            title,
            message,
            entityType,
            entityId,
          },
        }),
      ),
    );

    return notifications;
  }
}


