import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, NotificationType, TemplateType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BaseService } from '../../common/services/base.service';
import { ErrorMessages } from '../../common/constants/error-messages.const';
import { EmailService } from '../../common/email/email.service';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class NotificationsService extends BaseService {
  constructor(
    prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly templatesService: TemplatesService,
  ) {
    super(prisma);
  }

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
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Notification', notificationId));
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
      this.logger.log(`[Notifications] No settings found for user ${userId}, defaulting to enabled`);
      return true;
    }

    // If in-app notifications are disabled globally, don't notify
    if (!settings.inAppEnabled) {
      this.logger.log(`[Notifications] In-app notifications disabled for user ${userId}`);
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
      case NotificationType.FEEDBACK_REPORT:
        return settings.feedbackReport ?? true;
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
        this.logger.error(`[Notifications] Failed to send email notification to user ${userId}:`, error);
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
          this.logger.error(`[Notifications] Failed to send email notification to user ${userId}:`, error);
        },
      );
    }

    return notifications;
  }

  /**
   * Map NotificationType to TemplateType for email templates
   */
  private getTemplateTypeForNotification(notificationType: NotificationType): TemplateType | null {
    const mapping: Record<NotificationType, TemplateType | null> = {
      MENTIONED_IN_ACTIVITY: TemplateType.MENTION_NOTIFICATION,
      TASK_ASSIGNED: TemplateType.TASK_ASSIGNED,
      LEAVE_APPROVED: TemplateType.LEAVE_REQUEST_APPROVED,
      LEAVE_REJECTED: TemplateType.LEAVE_REQUEST_REJECTED,
      LEAVE_REQUEST: TemplateType.LEAVE_REQUEST_CREATED,
      TASK_DUE_SOON: null, // No template for this yet
      PERFORMANCE_REVIEW: TemplateType.PERFORMANCE_REVIEW,
      FEEDBACK_REPORT: null, // No template for this yet
      NEW_CANDIDATE: null, // No template for this yet
      NEW_OPPORTUNITY: null, // No template for this yet
      INVOICE_OVERDUE: null, // No template for this yet
      MEETING_REMINDER: null, // No template for this yet
      SYSTEM: null, // No template for this yet
    };

    return mapping[notificationType] ?? null;
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
    this.logger.log(`[Notifications] Attempting to send email to user ${userId} for type ${type}`);

    const settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    // If no settings, default to enabled for email (opt-in model)
    if (!settings) {
      this.logger.log(`[Notifications] No settings found for user ${userId}, defaulting email to enabled`);
    } else {
      // If email disabled globally, don't send
      if (!settings.emailEnabled) {
        this.logger.log(`[Notifications] Email notifications disabled globally for user ${userId}`);
        return;
      }
    }

    // Get user email
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user || !user.email) {
      this.logger.warn(`[Notifications] User ${userId} has no email address`);
      return;
    }

    this.logger.log(`[Notifications] Sending email to ${user.email} for notification type ${type}`);

    try {
      // Generate entity link if entityType and entityId are provided
      let entityLink: string | null = null;
      if (entityType && entityId) {
        entityLink = await this.generateEntityLink(entityType, entityId);
      }

      // Try to use template if available
      const templateType = this.getTemplateTypeForNotification(type);
      let htmlContent: string;
      let textContent: string;

      if (templateType) {
        try {
          // Build template data based on notification type
          const templateData = await this.buildTemplateData(
            type,
            user,
            message,
            entityType,
            entityId,
            entityLink,
          );

          // Debug: Log template data for mentions
          if (type === NotificationType.MENTIONED_IN_ACTIVITY) {
            this.logger.log(`[Notifications] Template data for mention:`, JSON.stringify(templateData, null, 2));
          }

          const rendered = await this.templatesService.renderDefault(templateType, templateData);
          htmlContent = rendered.html;
          textContent = rendered.text;
          this.logger.log(`[Notifications] ✅ Used template ${templateType} for notification type ${type}`);
        } catch (templateError) {
          this.logger.warn(
            `[Notifications] ⚠️  Failed to render template ${templateType}, falling back to default HTML:`,
            templateError,
          );
          // Fallback to default HTML
          htmlContent = `<p>${message.replace(/\n/g, '<br>')}</p>`;
          if (entityLink && entityType) {
            htmlContent += `<p><a href="${entityLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">View ${this.getEntityTypeLabel(entityType)}</a></p>`;
          }
          textContent = message + (entityLink && entityType ? `\n\nView ${this.getEntityTypeLabel(entityType)}: ${entityLink}` : '');
        }
      } else {
        // No template available, use default HTML
        htmlContent = `<p>${message.replace(/\n/g, '<br>')}</p>`;
        if (entityLink && entityType) {
          htmlContent += `<p><a href="${entityLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">View ${this.getEntityTypeLabel(entityType)}</a></p>`;
        }
        textContent = message + (entityLink && entityType ? `\n\nView ${this.getEntityTypeLabel(entityType)}: ${entityLink}` : '');
      }

      const emailSent = await this.emailService.sendEmail({
        to: user.email,
        subject: title,
        text: textContent,
        html: htmlContent,
      });

      if (emailSent) {
        this.logger.log(`[Notifications] ✅ Email successfully sent to ${user.email} for notification type ${type}`);
      } else {
        this.logger.error(`[Notifications] ❌ Email service returned false for ${user.email}. Check email configuration (EMAIL_FROM, SMTP_HOST, etc.)`);
      }
    } catch (error) {
      this.logger.error(`[Notifications] ❌ Failed to send email to ${user.email}:`, error);
      // Don't throw - we don't want email failures to break notification creation
    }
  }

  /**
   * Build template data for different notification types
   */
  private async buildTemplateData(
    notificationType: NotificationType,
    user: { email: string; firstName: string; lastName: string },
    message: string,
    entityType?: string,
    entityId?: string,
    entityLink?: string | null,
  ): Promise<Record<string, any>> {
    const baseData: Record<string, any> = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    switch (notificationType) {
      case NotificationType.MENTIONED_IN_ACTIVITY:
        // For mentions, we need to fetch the activity and who mentioned them
        if (entityType === 'activity' && entityId) {
          const activity = await this.prisma.activity.findUnique({
            where: { id: entityId },
            include: {
              createdBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              activityType: {
                select: {
                  name: true,
                },
              },
              customer: { select: { name: true } },
              lead: { select: { prospectCompanyName: true, title: true } },
              opportunity: { select: { title: true } },
              candidate: { select: { firstName: true, lastName: true } },
              employee: { select: { id: true } },
              task: { select: { title: true } },
            },
          });

          if (activity && activity.createdBy) {
            // Determine where the mention occurred
            let mentionContext = 'an activity';
            if (activity.customer) {
              mentionContext = `a customer activity (${activity.customer.name})`;
            } else if (activity.lead) {
              const leadName = activity.lead.prospectCompanyName || activity.lead.title || 'Lead';
              mentionContext = `a lead activity (${leadName})`;
            } else if (activity.opportunity) {
              mentionContext = `an opportunity activity (${activity.opportunity.title})`;
            } else if (activity.candidate) {
              mentionContext = `a candidate activity (${activity.candidate.firstName} ${activity.candidate.lastName})`;
            } else if (activity.task) {
              mentionContext = `a task activity (${activity.task.title})`;
            }

            return {
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.email || '',
              mentionedBy: {
                firstName: activity.createdBy.firstName || '',
                lastName: activity.createdBy.lastName || '',
              },
              entityType: this.getEntityTypeLabel(entityType),
              mentionContext,
              activity: {
                subject: activity.subject || '',
                content: activity.body || activity.subject || '',
                type: activity.activityType?.name || 'Activity',
                date: activity.activityDate ? new Date(activity.activityDate).toLocaleDateString() : undefined,
              },
              entityLink: entityLink || undefined,
            };
          }
        }
        // Fallback if activity not found
        return {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          mentionedBy: {
            firstName: '',
            lastName: '',
          },
          entityType: this.getEntityTypeLabel(entityType || 'activity'),
          mentionContext: 'an activity',
          activity: {
            subject: '',
            content: message || '',
            type: 'Activity',
            date: undefined,
          },
          entityLink: entityLink || undefined,
        };

      case NotificationType.TASK_ASSIGNED:
        if (entityType === 'task' && entityId) {
          const task = await this.prisma.task.findUnique({
            where: { id: entityId },
            include: {
              createdBy: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          });

          if (task) {
            return {
              ...baseData,
              assignedTo: {
                firstName: user.firstName,
              },
              task: {
                title: task.title,
                description: task.description,
                dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : undefined,
                priority: task.priority,
              },
              assignedBy: {
                firstName: task.createdBy?.firstName || '',
                lastName: task.createdBy?.lastName || '',
              },
            };
          }
        }
        return baseData;

      case NotificationType.LEAVE_APPROVED:
      case NotificationType.LEAVE_REJECTED:
      case NotificationType.LEAVE_REQUEST:
        // For leave requests, we'd need to fetch the leave request
        // For now, return basic data
        return {
          ...baseData,
          employee: {
            firstName: user.firstName,
            lastName: user.lastName,
          },
          request: {
            startDate: 'N/A', // Would need to fetch from leave request
            endDate: 'N/A',
            type: 'N/A',
          },
        };

      default:
        return baseData;
    }
  }

  /**
   * Generate a frontend URL for an entity based on its type and ID
   */
  private async generateEntityLink(entityType: string, entityId: string): Promise<string | null> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      this.logger.warn('[Notifications] FRONTEND_URL not configured, cannot generate entity links');
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
      this.logger.warn(`[Notifications] Unknown entity type: ${entityType}`);
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


