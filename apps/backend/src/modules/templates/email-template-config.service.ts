import { Injectable, NotFoundException } from '@nestjs/common';
import { TemplateType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TemplatesService } from './templates.service';
import { EmailService } from '../../common/email/email.service';

export type EmailActionType =
  | 'EOD_REPORT_SUBMITTED'
  | 'LEAVE_REQUEST_CREATED'
  | 'LEAVE_REQUEST_APPROVED'
  | 'LEAVE_REQUEST_REJECTED'
  | 'TASK_ASSIGNED'
  | 'MENTION_NOTIFICATION'
  | 'REMOTE_WORK_WINDOW_OPENED';

@Injectable()
export class EmailTemplateConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templatesService: TemplatesService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Get the configured template ID for a specific email action
   */
  async getTemplateIdForAction(action: EmailActionType): Promise<string | null> {
    const settings = await this.prisma.companySettings.findFirst();
    if (!settings) {
      return null;
    }

    const fieldMap: Record<EmailActionType, string> = {
      EOD_REPORT_SUBMITTED: 'emailTemplateEodReportSubmittedId',
      LEAVE_REQUEST_CREATED: 'emailTemplateLeaveRequestCreatedId',
      LEAVE_REQUEST_APPROVED: 'emailTemplateLeaveRequestApprovedId',
      LEAVE_REQUEST_REJECTED: 'emailTemplateLeaveRequestRejectedId',
      TASK_ASSIGNED: 'emailTemplateTaskAssignedId',
      MENTION_NOTIFICATION: 'emailTemplateMentionNotificationId',
      REMOTE_WORK_WINDOW_OPENED: 'emailTemplateRemoteWorkWindowOpenedId',
    };

    const fieldName = fieldMap[action];
    const templateId = (settings as any)[fieldName] as string | null;
    return templateId;
  }

  /**
   * Get the default template for a specific email action type
   */
  async getDefaultTemplateForAction(action: EmailActionType): Promise<string | null> {
    // First try configured template
    const configuredId = await this.getTemplateIdForAction(action);
    if (configuredId) {
      return configuredId;
    }

    // Fallback to default template of the matching type
    const typeMap: Record<EmailActionType, TemplateType> = {
      EOD_REPORT_SUBMITTED: TemplateType.EOD_REPORT_SUBMITTED,
      LEAVE_REQUEST_CREATED: TemplateType.LEAVE_REQUEST_CREATED,
      LEAVE_REQUEST_APPROVED: TemplateType.LEAVE_REQUEST_APPROVED,
      LEAVE_REQUEST_REJECTED: TemplateType.LEAVE_REQUEST_REJECTED,
      TASK_ASSIGNED: TemplateType.TASK_ASSIGNED,
      MENTION_NOTIFICATION: TemplateType.MENTION_NOTIFICATION,
      REMOTE_WORK_WINDOW_OPENED: TemplateType.REMOTE_WORK_WINDOW_OPENED,
    };

    const templateType = typeMap[action];
    const defaultTemplate = await this.prisma.template.findFirst({
      where: {
        type: templateType,
        isDefault: true,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return defaultTemplate?.id ?? null;
  }

  /**
   * Send an email using the configured template for an action
   */
  async sendEmailWithTemplate(
    action: EmailActionType,
    to: string | string[],
    data: Record<string, any>,
    options?: {
      subject?: string;
      from?: string;
      cc?: string | string[];
      bcc?: string | string[];
    },
  ): Promise<boolean> {
    const templateId = await this.getDefaultTemplateForAction(action);
    
    if (!templateId) {
      console.warn(`[EmailTemplateConfig] No template configured for action: ${action}`);
      return false;
    }

    try {
      const { html, text } = await this.templatesService.renderTemplateById(templateId, data);
      
      const subject = options?.subject || this.getDefaultSubject(action, data);
      
      return await this.emailService.sendEmail({
        to,
        subject,
        html,
        text,
        from: options?.from,
        cc: options?.cc,
        bcc: options?.bcc,
      });
    } catch (error) {
      console.error(`[EmailTemplateConfig] Failed to send email for action ${action}:`, error);
      return false;
    }
  }

  /**
   * Get default subject for an email action
   */
  private getDefaultSubject(action: EmailActionType, data: Record<string, any>): string {
    const subjectMap: Record<EmailActionType, string> = {
      EOD_REPORT_SUBMITTED: `EOD Report Submitted - ${data.report?.date || 'Report'}`,
      LEAVE_REQUEST_CREATED: 'Leave Request Submitted',
      LEAVE_REQUEST_APPROVED: 'Leave Request Approved',
      LEAVE_REQUEST_REJECTED: 'Leave Request Rejected',
      TASK_ASSIGNED: `Task Assigned: ${data.task?.title || 'New Task'}`,
      MENTION_NOTIFICATION: `You were mentioned in ${data.entityType || 'an activity'}`,
      REMOTE_WORK_WINDOW_OPENED: 'Remote Work Window Opened',
    };

    return subjectMap[action] || 'Notification';
  }

  /**
   * Update the template configuration for an email action
   */
  async setTemplateForAction(action: EmailActionType, templateId: string | null): Promise<void> {
    // Verify template exists if provided
    if (templateId) {
      const template = await this.prisma.template.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        throw new NotFoundException(`Template with ID ${templateId} not found`);
      }
    }

    const settings = await this.prisma.companySettings.findFirst();
    if (!settings) {
      throw new NotFoundException('Company settings not found');
    }

    const fieldMap: Record<EmailActionType, string> = {
      EOD_REPORT_SUBMITTED: 'emailTemplateEodReportSubmittedId',
      LEAVE_REQUEST_CREATED: 'emailTemplateLeaveRequestCreatedId',
      LEAVE_REQUEST_APPROVED: 'emailTemplateLeaveRequestApprovedId',
      LEAVE_REQUEST_REJECTED: 'emailTemplateLeaveRequestRejectedId',
      TASK_ASSIGNED: 'emailTemplateTaskAssignedId',
      MENTION_NOTIFICATION: 'emailTemplateMentionNotificationId',
      REMOTE_WORK_WINDOW_OPENED: 'emailTemplateRemoteWorkWindowOpenedId',
    };

    const fieldName = fieldMap[action];
    const updateData: any = {
      [fieldName]: templateId,
    };

    await this.prisma.companySettings.update({
      where: { id: settings.id },
      data: updateData,
    });
  }

  /**
   * Get all email template configurations
   */
  async getAllConfigurations(): Promise<Record<EmailActionType, string | null>> {
    const settings = await this.prisma.companySettings.findFirst();
    if (!settings) {
      return {
        EOD_REPORT_SUBMITTED: null,
        LEAVE_REQUEST_CREATED: null,
        LEAVE_REQUEST_APPROVED: null,
        LEAVE_REQUEST_REJECTED: null,
        TASK_ASSIGNED: null,
        MENTION_NOTIFICATION: null,
        REMOTE_WORK_WINDOW_OPENED: null,
      };
    }

    return {
      EOD_REPORT_SUBMITTED: (settings as any).emailTemplateEodReportSubmittedId ?? null,
      LEAVE_REQUEST_CREATED: (settings as any).emailTemplateLeaveRequestCreatedId ?? null,
      LEAVE_REQUEST_APPROVED: (settings as any).emailTemplateLeaveRequestApprovedId ?? null,
      LEAVE_REQUEST_REJECTED: (settings as any).emailTemplateLeaveRequestRejectedId ?? null,
      TASK_ASSIGNED: (settings as any).emailTemplateTaskAssignedId ?? null,
      MENTION_NOTIFICATION: (settings as any).emailTemplateMentionNotificationId ?? null,
      REMOTE_WORK_WINDOW_OPENED: (settings as any).emailTemplateRemoteWorkWindowOpenedId ?? null,
    };
  }
}

