/**
 * IMAP IDLE Listener Service for info@ringdom.org
 * ================================================
 * Real-time email detection using IMAP IDLE command
 * Reference: Email Automation Specialist skillset
 */

import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { EventEmitter } from 'events';
import { emailConfig } from './config';
import { logger } from '@/lib/logger';

// Event types emitted by the listener
export interface EmailReceivedEvent {
  uid: number;
  messageId: string;
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  date: Date;
  headers: Record<string, string>;
  inReplyTo: string | null;
  references: string[];
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }>;
  raw: ParsedMail;
}

export interface ImapListenerEvents {
  email: (event: EmailReceivedEvent) => void;
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  ready: () => void;
}

export class ImapListener extends EventEmitter {
  private imap: Imap | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // Start with 5 seconds
  private isRunning = false;
  private lastUid: number = 0;
  private mailbox = 'INBOX';

  constructor(private config: typeof emailConfig) {
    super();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[IMAP] Listener already running');
      return;
    }

    this.isRunning = true;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.imap) {
      this.imap.end();
      this.imap = null;
    }
    logger.info('[IMAP] Listener stopped');
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.imap = new Imap({
          user: this.config.user,
          password: this.config.password,
          host: this.config.host,
          port: this.config.port,
          tls: this.config.tls,
          tlsOptions: {
            rejectUnauthorized: this.config.tlsRejectUnauthorized,
          },
          keepalive: {
            interval: 10000, // 10 seconds
            idleInterval: 300000, // 5 minutes for IDLE refresh
            forceNoop: false,
          },
          authTimeout: 30000, // 30 seconds auth timeout
        });

        this.imap.once('ready', async () => {
          this.reconnectAttempts = 0;
          this.reconnectDelay = 5000;
          logger.info('[IMAP] Connected to mail.ringdom.org');
          this.emit('connected');
          
          try {
            await this.openMailbox();
            await this.fetchUnseenMessages();
            this.startIdleMode();
            this.emit('ready');
            resolve();
          } catch (err) {
            reject(err);
          }
        });

        this.imap.on('error', (err: Error) => {
          logger.error('[IMAP] Connection error', { error: err.message });
          this.emit('error', err);
        });

        this.imap.on('end', () => {
          logger.info('[IMAP] Connection ended');
          this.emit('disconnected');
          this.handleReconnect();
        });

        this.imap.on('close', (hadError: boolean) => {
          if (hadError) {
            logger.warn('[IMAP] Connection closed with error');
          }
          this.handleReconnect();
        });

        this.imap.connect();
      } catch (err) {
        reject(err);
      }
    });
  }

  private async openMailbox(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) return reject(new Error('IMAP not initialized'));

      this.imap.openBox(this.mailbox, false, (err, box) => {
        if (err) {
          logger.error('[IMAP] Failed to open mailbox', { error: err.message });
          return reject(err);
        }
        logger.info('[IMAP] Mailbox opened', { 
          name: box.name, 
          messages: box.messages.total,
          unseen: box.messages.unseen
        });
        resolve();
      });
    });
  }

  private async fetchUnseenMessages(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) return reject(new Error('IMAP not initialized'));

      // Search for unseen messages
      this.imap.search(['UNSEEN'], (err, uids) => {
        if (err) {
          logger.error('[IMAP] Search failed', { error: err.message });
          return reject(err);
        }

        if (!uids || uids.length === 0) {
          logger.info('[IMAP] No unseen messages');
          return resolve();
        }

        logger.info('[IMAP] Found unseen messages', { count: uids.length });
        this.fetchMessages(uids)
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  private async fetchMessages(uids: number[]): Promise<void> {
    if (!this.imap || uids.length === 0) return;

    return new Promise((resolve, reject) => {
      const fetch = this.imap!.fetch(uids, {
        bodies: [''],
        struct: true,
        envelope: true,
      });

      fetch.on('message', (msg, seqno) => {
        let rawEmail = '';

        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            rawEmail += chunk.toString('utf8');
          });
        });

        msg.once('attributes', async (attrs) => {
          const uid = attrs.uid;
          this.lastUid = Math.max(this.lastUid, uid);

          // Wait for body to complete
          msg.once('end', async () => {
            try {
              const parsed = await this.parseEmail(rawEmail, uid);
              if (parsed) {
                this.emit('email', parsed);
              }
            } catch (err) {
              logger.error('[IMAP] Failed to parse email', { 
                uid, 
                error: (err as Error).message 
              });
            }
          });
        });
      });

      fetch.once('error', (err) => {
        logger.error('[IMAP] Fetch error', { error: err.message });
        reject(err);
      });

      fetch.once('end', () => {
        resolve();
      });
    });
  }

  private async parseEmail(raw: string, uid: number): Promise<EmailReceivedEvent | null> {
    try {
      const parsed = await simpleParser(raw);

      const fromAddress = parsed.from?.value?.[0];
      const toAddress = parsed.to ? 
        (Array.isArray(parsed.to) ? parsed.to[0]?.value?.[0] : parsed.to.value?.[0]) : 
        null;

      // Extract references for thread reconstruction
      const references: string[] = [];
      if (parsed.references) {
        if (Array.isArray(parsed.references)) {
          references.push(...parsed.references);
        } else {
          references.push(parsed.references);
        }
      }

      // Extract all headers as a simple object
      const headers: Record<string, string> = {};
      if (parsed.headers) {
        parsed.headers.forEach((value, key) => {
          headers[key] = String(value);
        });
      }

      // Parse attachments
      const attachments = (parsed.attachments || []).map((att) => ({
        filename: att.filename || 'unnamed',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        content: att.content,
      }));

      const event: EmailReceivedEvent = {
        uid,
        messageId: parsed.messageId || `${uid}@mail.ringdom.org`,
        from: fromAddress?.address || '',
        fromName: fromAddress?.name || null,
        to: toAddress?.address || 'info@ringdom.org',
        subject: parsed.subject || '(No Subject)',
        bodyText: parsed.text || null,
        bodyHtml: parsed.html || null,
        date: parsed.date || new Date(),
        headers,
        inReplyTo: parsed.inReplyTo || null,
        references,
        attachments,
        raw: parsed,
      };

      logger.info('[IMAP] Email parsed', {
        uid,
        messageId: event.messageId,
        from: event.from,
        subject: event.subject,
      });

      return event;
    } catch (err) {
      logger.error('[IMAP] Parse error', { uid, error: (err as Error).message });
      return null;
    }
  }

  private startIdleMode(): void {
    if (!this.imap || !this.isRunning) return;

    // Listen for new mail events
    this.imap.on('mail', (numNewMsgs: number) => {
      logger.info('[IMAP] New mail notification', { count: numNewMsgs });
      this.fetchUnseenMessages().catch((err) => {
        logger.error('[IMAP] Failed to fetch new messages', { error: err.message });
      });
    });

    // Listen for expunge events (deleted messages)
    this.imap.on('expunge', (seqno: number) => {
      logger.debug('[IMAP] Message expunged', { seqno });
    });

    // Listen for flag updates
    this.imap.on('update', (seqno: number, info: unknown) => {
      logger.debug('[IMAP] Message updated', { seqno, info });
    });

    logger.info('[IMAP] IDLE mode active - listening for new emails');
  }

  private handleReconnect(): void {
    if (!this.isRunning) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[IMAP] Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 60000);
    
    logger.info('[IMAP] Reconnecting...', { 
      attempt: this.reconnectAttempts, 
      delay: `${delay}ms` 
    });

    setTimeout(() => {
      this.connect().catch((err) => {
        logger.error('[IMAP] Reconnection failed', { error: err.message });
      });
    }, delay);
  }

  // Mark message as seen/read
  async markAsSeen(uid: number): Promise<void> {
    if (!this.imap) throw new Error('IMAP not connected');

    return new Promise((resolve, reject) => {
      this.imap!.addFlags(uid, ['\\Seen'], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  // Move message to another folder
  async moveToFolder(uid: number, folder: string): Promise<void> {
    if (!this.imap) throw new Error('IMAP not connected');

    return new Promise((resolve, reject) => {
      this.imap!.move(uid, folder, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  // Get connection status
  isConnected(): boolean {
    return this.imap?.state === 'authenticated' || false;
  }
}

// Singleton instance
let listenerInstance: ImapListener | null = null;

export function getImapListener(): ImapListener {
  if (!listenerInstance) {
    listenerInstance = new ImapListener(emailConfig);
  }
  return listenerInstance;
}

export default ImapListener;
