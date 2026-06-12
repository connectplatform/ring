/**
 * SMTP outbound mail for email CRM replies
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { emailConfig } from '../imap/config';
import { logger } from '@/lib/logger';

export interface SendReplyParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string | null;
  references?: string[];
}

export class EmailSenderService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const port = emailConfig.smtp.port;
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port,
        secure: port === 465,
        auth: {
          user: emailConfig.smtp.auth.user,
          pass: emailConfig.smtp.auth.pass,
        },
      });
    }
    return this.transporter;
  }

  async sendReply(params: SendReplyParams): Promise<{ messageId: string }> {
    const transport = this.getTransporter();
    const refs = params.references?.filter(Boolean) ?? [];
    const headers: Record<string, string> = {};
    if (params.inReplyTo) {
      headers['In-Reply-To'] = params.inReplyTo;
      headers.References = refs.length > 0 ? refs.join(' ') : params.inReplyTo;
    }

    const result = await transport.sendMail({
      from: emailConfig.smtp.auth.user,
      to: params.to,
      subject: params.subject.startsWith('Re:') ? params.subject : `Re: ${params.subject}`,
      text: params.text,
      html: params.html,
      headers,
    });

    const messageId = result.messageId || `smtp_${Date.now()}`;
    logger.info('[EmailSender] Reply sent', { to: params.to, messageId });
    return { messageId };
  }
}

let senderInstance: EmailSenderService | null = null;

export function getEmailSender(): EmailSenderService {
  if (!senderInstance) {
    senderInstance = new EmailSenderService();
  }
  return senderInstance;
}
