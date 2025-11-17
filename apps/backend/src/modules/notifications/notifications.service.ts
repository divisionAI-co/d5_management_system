import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, NotificationType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

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

    // If no settings exist, default to enabled (opt-in model)
    if (!settings) {
      console.log(`[Notifications] No settings found for user ${userId}, defaulting to enabled`);
      return true;
    }

    // If in-app notifications are disabled globally, don't notify
    if (!settings.inAppEnabled) {
      console.log(`[Notifications] In-app notifications disabled for user ${userId}`);
      return false;
    }

    // Check type-specific preference
    switch (notificationType) {
      case NotificationType.TASK_ASSIGNED:
        return settings.taskAssigned ?? true; // Default to true if not set
      case NotificationType.TASK_DUE_SOON:
        return settings.taskDueSoon ?? true;
      case NotificationType.LEAVE_APPROVED:
        return settings.leaveApproved ?? true;
      case NotificationType.PERFORMANCE_REVIEW:
        return settings.performanceReview ?? true;
      case NotificationType.NEW_CANDIDATE:
        return settings.newCandidate ?? true;
      case NotificationType.NEW_OPPORTUNITY:
        return settings.newOpportunity ?? true;
      case NotificationType.MENTIONED_IN_ACTIVITY:
        return settings.mentionedInActivity ?? true; // Default to true if not set
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

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        entityType,
        entityId,
      },
    });

    // Send email notification if enabled
    this.sendEmailNotification(userId, type, title, message, entityType, entityId).catch(
      (error) => {
        console.error(`[Notifications] Failed to send email notification to user ${userId}:`, error);
      },
    );

    return notification;
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

    // Send email notifications if enabled
    for (const userId of usersToNotify) {
      this.sendEmailNotification(userId, type, title, message, entityType, entityId).catch(
        (error) => {
          console.error(`[Notifications] Failed to send email notification to user ${userId}:`, error);
        },
      );
    }

    return notifications;
  }

  /**
   * Send email notification if user has email notifications enabled
   */
  private async sendEmailNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    entityType?: string,
    entityId?: string,
  ) {
    console.log(`[Notifications] Attempting to send email to user ${userId} for type ${type}`);

    const settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    // If no settings, default to enabled for email (opt-in model)
    if (!settings) {
      console.log(`[Notifications] No settings found for user ${userId}, defaulting email to enabled`);
    } else {
      // If email disabled globally, don't send
      if (!settings.emailEnabled) {
        console.log(`[Notifications] Email notifications disabled globally for user ${userId}`);
        return;
      }
    }

    // Get user email
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user || !user.email) {
      console.warn(`[Notifications] User ${userId} has no email address`);
      return;
    }

    console.log(`[Notifications] Sending email to ${user.email} for notification type ${type}`);

    try {
      // Generate entity link if entityType and entityId are provided
      let entityLink: string | null = null;
      if (entityType && entityId) {
        entityLink = await this.generateEntityLink(entityType, entityId);
      }

      // Build HTML email with link if available
      let htmlContent = `<p>${message.replace(/\n/g, '<br>')}</p>`;
      if (entityLink && entityType) {
        htmlContent += `<p><a href="${entityLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">View ${this.getEntityTypeLabel(entityType)}</a></p>`;
      }

      const emailSent = await this.emailService.sendEmail({
        to: user.email,
        subject: title,
        text: message + (entityLink && entityType ? `\n\nView ${this.getEntityTypeLabel(entityType)}: ${entityLink}` : ''),
        html: htmlContent,
      });

      if (emailSent) {
        console.log(`[Notifications] ✅ Email successfully sent to ${user.email} for notification type ${type}`);
      } else {
        console.error(`[Notifications] ❌ Email service returned false for ${user.email}. Check email configuration (EMAIL_FROM, SMTP_HOST, etc.)`);
      }
    } catch (error) {
      console.error(`[Notifications] ❌ Failed to send email to ${user.email}:`, error);
      // Don't throw - we don't want email failures to break notification creation
    }
  }

  /**
   * Generate a frontend URL for an entity based on its type and ID
   */
  private async generateEntityLink(entityType: string, entityId: string): Promise<string | null> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      console.warn('[Notifications] FRONTEND_URL not configured, cannot generate entity links');
      return null;
    }

    // For activities, we need to fetch the activity to determine which entity it belongs to
    if (entityType === 'activity') {
      const activity = await this.prisma.activity.findUnique({
        where: { id: entityId },
        select: {
          customerId: true,
          leadId: true,
          opportunityId: true,
          candidateId: true,
          employeeId: true,
          contactId: true,
          taskId: true,
        },
      });

      if (!activity) {
        return null;
      }

      // Determine the parent entity
      if (activity.customerId) {
        return `${frontendUrl}/crm/customers/${activity.customerId}?openActivitySidebar=true&activityId=${entityId}`;
      } else if (activity.leadId) {
        return `${frontendUrl}/crm/leads/${activity.leadId}?openActivitySidebar=true&activityId=${entityId}`;
      } else if (activity.opportunityId) {
        return `${frontendUrl}/crm/opportunities/${activity.opportunityId}?openActivitySidebar=true&activityId=${entityId}`;
      } else if (activity.candidateId) {
        return `${frontendUrl}/recruitment/candidates/${activity.candidateId}?openActivitySidebar=true&activityId=${entityId}`;
      } else if (activity.employeeId) {
        return `${frontendUrl}/employees/${activity.employeeId}?openActivitySidebar=true&activityId=${entityId}`;
      } else if (activity.taskId) {
        return `${frontendUrl}/tasks?taskId=${activity.taskId}`;
      } else if (activity.contactId) {
        return `${frontendUrl}/crm/contacts`;
      }

      return null;
    }

    // For other entity types, generate direct links
    const routeMap: Record<string, string> = {
      opportunity: `/crm/opportunities/${entityId}`,
      candidate: `/recruitment/candidates/${entityId}`,
      customer: `/crm/customers/${entityId}`,
      lead: `/crm/leads/${entityId}`,
      employee: `/employees/${entityId}`,
      task: `/tasks?taskId=${entityId}`,
      contact: `/crm/contacts`,
    };

    const route = routeMap[entityType];
    if (!route) {
      console.warn(`[Notifications] Unknown entity type: ${entityType}`);
      return null;
    }

    return `${frontendUrl}${route}`;
  }

  /**
   * Get a human-readable label for an entity type
   */
  private getEntityTypeLabel(entityType: string): string {
    const labels: Record<string, string> = {
      activity: 'Activity',
      opportunity: 'Opportunity',
      candidate: 'Candidate',
      customer: 'Customer',
      lead: 'Lead',
      employee: 'Employee',
      task: 'Task',
      contact: 'Contact',
    };

    return labels[entityType] || 'Item';
  }
}


