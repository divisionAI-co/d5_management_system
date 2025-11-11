import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: nodemailer.Transporter;
  private provider: string;

  constructor(private configService: ConfigService) {
    this.provider = this.configService.get<string>('EMAIL_PROVIDER', 'smtp');
    this.initializeEmailProvider();
  }

  private initializeEmailProvider() {
    switch (this.provider) {
      case 'sendgrid':
        const sendgridKey = this.configService.get<string>('SENDGRID_API_KEY');
        if (sendgridKey) {
          sgMail.setApiKey(sendgridKey);
          this.logger.log('SendGrid email provider initialized');
        }
        break;

      case 'smtp':
      default:
        this.transporter = nodemailer.createTransport({
          host: this.configService.get<string>('SMTP_HOST'),
          port: this.configService.get<number>('SMTP_PORT', 587),
          secure: this.configService.get<boolean>('SMTP_SECURE', false),
          auth: {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASSWORD'),
          },
        });
        this.logger.log('SMTP email provider initialized');
        break;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const from = options.from || this.configService.get<string>('EMAIL_FROM');

      if (this.provider === 'sendgrid') {
        const attachments = options.attachments
          ?.map((attachment) => {
            if (attachment.content instanceof Buffer) {
              return {
                filename: attachment.filename,
                content: attachment.content.toString('base64'),
                type: attachment.contentType,
                disposition: 'attachment',
              };
            }

            if (typeof attachment.content === 'string') {
              return {
                filename: attachment.filename,
                content: Buffer.from(attachment.content).toString('base64'),
                type: attachment.contentType,
                disposition: 'attachment',
              };
            }

            this.logger.warn(
              `SendGrid attachments must provide content buffer or string. Skipping attachment ${attachment.filename}`,
            );

            return undefined;
          })
          .filter(Boolean) as Array<{
            filename: string;
            content: string;
            type?: string;
            disposition?: string;
          }>;

        await sgMail.send({
          to: options.to,
          from: from!,
          subject: options.subject,
          html: options.html,
          text: options.text || '',
          cc: options.cc,
          bcc: options.bcc,
          attachments: attachments?.length ? attachments : undefined,
        });
      } else {
        await this.transporter.sendMail({
          from,
          to: options.to,
          cc: options.cc,
          bcc: options.bcc,
          subject: options.subject,
          html: options.html,
          text: options.text || '',
          attachments: options.attachments,
        });
      }

      this.logger.log(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      return false;
    }
  }

  async sendBulkEmail(recipients: string[], options: Omit<EmailOptions, 'to'>): Promise<{
    sent: number;
    failed: number;
  }> {
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const success = await this.sendEmail({
        ...options,
        to: recipient,
      });

      if (success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Welcome to D5 Management System',
      html: `
        <h1>Welcome ${name}!</h1>
        <p>Your account has been created successfully.</p>
        <p>You can now log in to the system and start using all the features.</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;
    
    return this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  }

  async sendNotificationEmail(
    email: string,
    notification: { title: string; message: string },
  ): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: notification.title,
      html: `
        <h2>${notification.title}</h2>
        <p>${notification.message}</p>
      `,
    });
  }
}

