import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PeerCertificate, TlsOptions } from 'tls';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

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

  private getBooleanEnv(key: string, defaultValue = false): boolean {
    const value = this.configService.get<string | boolean>(key);
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === undefined || value === null) {
      return defaultValue;
    }

    const normalized = String(value).trim().toLowerCase();
    return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
  }

  private getStringEnv(key: string): string | undefined {
    const value = this.configService.get<string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return value;
  }

  private isProduction(): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    return nodeEnv?.toLowerCase() === 'production';
  }

  private normalizeCertificate(certificate: string): string | Buffer {
    const trimmed = certificate.trim();

    if (trimmed.startsWith('-----BEGIN')) {
      return trimmed;
    }

    try {
      return Buffer.from(trimmed, 'base64');
    } catch (error) {
      this.logger.warn(
        `Failed to decode SMTP_CA_CERT as base64: ${error instanceof Error ? error.message : String(error)}`,
      );
      return trimmed;
    }
  }

  private buildSmtpTlsOptions(): TlsOptions {
    const defaultAllowSelfSigned = this.isProduction() ? false : true;
    const allowSelfSigned = this.getBooleanEnv('SMTP_ALLOW_SELF_SIGNED', defaultAllowSelfSigned);
    const defaultRejectUnauthorized = this.isProduction() ? true : !allowSelfSigned;
    const rejectUnauthorized = this.getBooleanEnv('SMTP_REJECT_UNAUTHORIZED', defaultRejectUnauthorized);
    const caCert = this.getStringEnv('SMTP_CA_CERT');
    const caPath = this.getStringEnv('SMTP_CA_CERT_PATH');
    const servername = this.getStringEnv('SMTP_TLS_SERVERNAME');

    const tlsOptions: TlsOptions & {
      checkServerIdentity?: (servername: string, cert: PeerCertificate) => Error | undefined;
      servername?: string;
    } = {
      rejectUnauthorized,
    };

    if (allowSelfSigned) {
      tlsOptions.rejectUnauthorized = false;
      tlsOptions.checkServerIdentity = () => undefined;
    }

    const caCertificates: Array<string | Buffer> = [];

    if (caCert) {
      caCertificates.push(this.normalizeCertificate(caCert));
    }

    if (caPath) {
      try {
        const resolvedPath = resolve(process.cwd(), caPath);
        caCertificates.push(readFileSync(resolvedPath));
      } catch (error) {
        this.logger.warn(
          `Failed to read SMTP_CA_CERT_PATH (${caPath}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (caCertificates.length > 0) {
      tlsOptions.ca = caCertificates;
    }

    if (servername) {
      tlsOptions.servername = servername;
    }

    const ciphers = this.getStringEnv('SMTP_TLS_CIPHERS');
    if (ciphers) {
      tlsOptions.ciphers = ciphers;
    }

    return tlsOptions;
  }

  private getNumberEnv(key: string, defaultValue?: number): number | undefined {
    const value = this.configService.get<string | number | undefined>(key);

    if (typeof value === 'number') {
      return value;
    }

    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
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
          port: this.getNumberEnv('SMTP_PORT', 587),
          secure: this.getBooleanEnv('SMTP_SECURE', false),
          auth: {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASSWORD'),
          },
          requireTLS: this.getBooleanEnv('SMTP_REQUIRE_TLS', false),
          tls: this.buildSmtpTlsOptions(),
        } as unknown as SMTPTransport.Options);
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
      subject: 'Welcome to division5',
      html: `
        <h1>Welcome ${name}!</h1>
        <p>Your account has been created successfully.</p>
        <p>You can now log in to the system and start using all the features.</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;
    const expiryHoursRaw = this.configService.get<string>('PASSWORD_RESET_TOKEN_EXPIRY_HOURS');
    let readableExpiry = '1 hour';

    if (expiryHoursRaw) {
      const parsed = Number(expiryHoursRaw);
      if (Number.isFinite(parsed) && parsed > 0) {
        readableExpiry = parsed === 1 ? '1 hour' : `${parsed} hours`;
      }
    }
    
    return this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in ${readableExpiry}.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  }

  async sendUserInvitationEmail(email: string, name: string, resetToken: string, expiresAt: Date): Promise<boolean> {
    const inviteUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;
    const readableExpiry = expiresAt.toLocaleString();

    return this.sendEmail({
      to: email,
      subject: 'You have been invited to division5',
      html: `
        <h1>Welcome${name ? `, ${name}` : ''}!</h1>
        <p>An administrator has created an account for you in division5.</p>
        <p>To finish setting up your account, please create your password using the link below:</p>
        <p><a href="${inviteUrl}">Set up your password</a></p>
        <p><strong>Important:</strong> this link will expire on <strong>${readableExpiry}</strong>.</p>
        <p>If you were not expecting this invitation, you can ignore this email.</p>
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

