/**
 * Email Parser Service
 * ====================
 * Handles parsing, thread reconstruction, and attachment processing
 * Reference: Email Automation Specialist skillset
 */

import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { createHash } from 'crypto';
import { EmailReceivedEvent } from '../imap/imap-listener';
import { logger } from '@/lib/logger';

// Parsed email structure for database storage
export interface ParsedEmail {
  // Identifiers
  messageId: string;
  externalThreadId: string | null;
  inReplyTo: string | null;
  references: string[];
  
  // Addresses
  from: {
    email: string;
    name: string | null;
  };
  to: {
    email: string;
    name: string | null;
  }[];
  cc: {
    email: string;
    name: string | null;
  }[];
  replyTo: {
    email: string;
    name: string | null;
  } | null;
  
  // Content
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  bodyTextClean: string; // Cleaned for AI processing
  
  // Metadata
  date: Date;
  rawHeaders: Record<string, string>;
  
  // Attachments
  attachments: ParsedAttachment[];
  hasAttachments: boolean;
  
  // Thread info
  isReply: boolean;
  conversationDepth: number; // Estimated thread depth
  
  // Hash for deduplication
  contentHash: string;
}

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  contentId: string | null; // For inline attachments
  isInline: boolean;
  checksum: string; // For deduplication
}

// Quote patterns for cleaning email bodies
const QUOTE_PATTERNS = [
  /^>+.*$/gm, // Standard quote markers
  /^On.*wrote:$/gm, // Gmail-style
  /^-{2,}Original Message-{2,}$/gm, // Outlook
  /^From:.*\nSent:.*\nTo:.*\nSubject:.*/gm, // Forwarded headers
  /_{3,}.*$/gm, // Signature separators
  /^Sent from my.*/gm, // Mobile signatures
];

// Signature patterns to remove
const SIGNATURE_PATTERNS = [
  /^--\s*$/gm, // RFC signature delimiter
  /^Best regards?,?\s*$/gim,
  /^Thanks?,?\s*$/gim,
  /^Cheers,?\s*$/gim,
  /^Kind regards?,?\s*$/gim,
  /^Sincerely,?\s*$/gim,
  /^Warm regards?,?\s*$/gim,
];

export class EmailParser {
  /**
   * Parse raw email data from IMAP event
   */
  async parseFromEvent(event: EmailReceivedEvent): Promise<ParsedEmail> {
    const parsed: ParsedEmail = {
      messageId: event.messageId,
      externalThreadId: this.extractThreadId(event.references, event.inReplyTo),
      inReplyTo: event.inReplyTo,
      references: event.references,
      
      from: {
        email: event.from,
        name: event.fromName,
      },
      to: [{
        email: event.to,
        name: null,
      }],
      cc: [],
      replyTo: null,
      
      subject: event.subject,
      bodyText: event.bodyText,
      bodyHtml: event.bodyHtml,
      bodyTextClean: this.cleanEmailBody(event.bodyText || ''),
      
      date: event.date,
      rawHeaders: event.headers,
      
      attachments: event.attachments.map(att => this.processAttachment(att)),
      hasAttachments: event.attachments.length > 0,
      
      isReply: !!event.inReplyTo || event.references.length > 0,
      conversationDepth: this.estimateConversationDepth(event.references, event.bodyText),
      
      contentHash: this.generateContentHash(event.from, event.subject, event.bodyText || ''),
    };

    logger.debug('[EmailParser] Parsed email', {
      messageId: parsed.messageId,
      from: parsed.from.email,
      subject: parsed.subject,
      isReply: parsed.isReply,
      hasAttachments: parsed.hasAttachments,
    });

    return parsed;
  }

  /**
   * Parse raw email string (e.g., from stored data)
   */
  async parseRaw(rawEmail: string): Promise<ParsedEmail> {
    const mail = await simpleParser(rawEmail);
    return this.parseFromMailparser(mail);
  }

  /**
   * Convert mailparser result to our format
   */
  private parseFromMailparser(mail: ParsedMail): ParsedEmail {
    const fromAddr = mail.from?.value?.[0];
    const toAddrs = mail.to ? 
      (Array.isArray(mail.to) ? mail.to.flatMap(t => t.value) : mail.to.value) : 
      [];
    const ccAddrs = mail.cc ? 
      (Array.isArray(mail.cc) ? mail.cc.flatMap(c => c.value) : mail.cc.value) : 
      [];
    const replyToAddr = mail.replyTo?.value?.[0];

    const references: string[] = [];
    if (mail.references) {
      if (Array.isArray(mail.references)) {
        references.push(...mail.references);
      } else {
        references.push(mail.references);
      }
    }

    const headers: Record<string, string> = {};
    if (mail.headers) {
      mail.headers.forEach((value, key) => {
        headers[key] = String(value);
      });
    }

    return {
      messageId: mail.messageId || `${Date.now()}@mail.ringdom.org`,
      externalThreadId: this.extractThreadId(references, mail.inReplyTo || null),
      inReplyTo: mail.inReplyTo || null,
      references,
      
      from: {
        email: fromAddr?.address || '',
        name: fromAddr?.name || null,
      },
      to: toAddrs.map(addr => ({
        email: addr.address || '',
        name: addr.name || null,
      })),
      cc: ccAddrs.map(addr => ({
        email: addr.address || '',
        name: addr.name || null,
      })),
      replyTo: replyToAddr ? {
        email: replyToAddr.address || '',
        name: replyToAddr.name || null,
      } : null,
      
      subject: mail.subject || '(No Subject)',
      bodyText: mail.text || null,
      bodyHtml: mail.html || null,
      bodyTextClean: this.cleanEmailBody(mail.text || ''),
      
      date: mail.date || new Date(),
      rawHeaders: headers,
      
      attachments: (mail.attachments || []).map(att => this.processAttachmentFromMailparser(att)),
      hasAttachments: (mail.attachments || []).length > 0,
      
      isReply: !!mail.inReplyTo || references.length > 0,
      conversationDepth: this.estimateConversationDepth(references, mail.text),
      
      contentHash: this.generateContentHash(
        fromAddr?.address || '',
        mail.subject || '',
        mail.text || ''
      ),
    };
  }

  /**
   * Extract thread ID from references chain
   * Uses the first message ID in the chain as the thread identifier
   */
  private extractThreadId(references: string[], inReplyTo: string | null): string | null {
    if (references.length > 0) {
      return references[0]; // First message in chain
    }
    return inReplyTo; // Or the immediate parent
  }

  /**
   * Clean email body for AI processing
   * Removes quotes, signatures, and formatting artifacts
   */
  cleanEmailBody(body: string): string {
    if (!body) return '';

    let cleaned = body;

    // Remove HTML artifacts if text contains them
    cleaned = cleaned
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    // Remove quoted content
    for (const pattern of QUOTE_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Find and remove signature
    const lines = cleaned.split('\n');
    const signatureStart = this.findSignatureStart(lines);
    if (signatureStart !== -1) {
      cleaned = lines.slice(0, signatureStart).join('\n');
    }

    // Clean up whitespace
    cleaned = cleaned
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]+$/gm, '') // Trailing whitespace
      .replace(/^[ \t]+/gm, '') // Leading whitespace on each line
      .trim();

    return cleaned;
  }

  /**
   * Find where signature begins in email lines
   */
  private findSignatureStart(lines: string[]): number {
    for (let i = 0; i < lines.length; i++) {
      for (const pattern of SIGNATURE_PATTERNS) {
        if (pattern.test(lines[i])) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Estimate conversation depth from references and quoted content
   */
  private estimateConversationDepth(references: string[], body: string | undefined | null): number {
    // Count references as minimum depth
    let depth = references.length;

    // Also count quote levels in body
    if (body) {
      const quoteMatches = body.match(/^>+/gm);
      if (quoteMatches) {
        const maxQuoteLevel = Math.max(...quoteMatches.map(m => m.length));
        depth = Math.max(depth, maxQuoteLevel);
      }
    }

    return depth;
  }

  /**
   * Process attachment from IMAP event
   */
  private processAttachment(att: {
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }): ParsedAttachment {
    return {
      filename: this.sanitizeFilename(att.filename),
      contentType: att.contentType,
      size: att.size,
      content: att.content,
      contentId: null,
      isInline: false,
      checksum: this.generateChecksum(att.content),
    };
  }

  /**
   * Process attachment from mailparser
   */
  private processAttachmentFromMailparser(att: Attachment): ParsedAttachment {
    return {
      filename: this.sanitizeFilename(att.filename || 'unnamed'),
      contentType: att.contentType || 'application/octet-stream',
      size: att.size || att.content.length,
      content: att.content,
      contentId: att.contentId || null,
      isInline: att.contentDisposition === 'inline',
      checksum: this.generateChecksum(att.content),
    };
  }

  /**
   * Sanitize filename for storage
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Invalid chars
      .replace(/\.{2,}/g, '.') // Multiple dots
      .slice(0, 255); // Max length
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(from: string, subject: string, body: string): string {
    const content = `${from}|${subject}|${body.slice(0, 1000)}`;
    return createHash('sha256').update(content).digest('hex').slice(0, 32);
  }

  /**
   * Generate checksum for attachment deduplication
   */
  private generateChecksum(content: Buffer): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Extract plain text from HTML body
   */
  extractTextFromHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detect if email is likely spam based on content patterns
   */
  detectSpamPatterns(email: ParsedEmail): {
    isLikelySpam: boolean;
    reasons: string[];
    confidence: number;
  } {
    const reasons: string[] = [];
    let spamScore = 0;

    // Check for suspicious patterns
    const bodyLower = (email.bodyTextClean || '').toLowerCase();
    const subjectLower = email.subject.toLowerCase();

    // Common spam indicators
    const spamKeywords = [
      'unsubscribe', 'click here', 'act now', 'limited time',
      'free money', 'winner', 'congratulations', 'claim your',
      'urgent', 'immediate action', 'account suspended',
    ];

    for (const keyword of spamKeywords) {
      if (bodyLower.includes(keyword) || subjectLower.includes(keyword)) {
        spamScore += 0.1;
        reasons.push(`Contains keyword: "${keyword}"`);
      }
    }

    // All caps subject
    if (email.subject === email.subject.toUpperCase() && email.subject.length > 10) {
      spamScore += 0.2;
      reasons.push('Subject is all caps');
    }

    // Excessive links in body
    const linkCount = (email.bodyHtml || '').match(/<a[^>]*href/gi)?.length || 0;
    if (linkCount > 10) {
      spamScore += 0.2;
      reasons.push('Excessive links');
    }

    // Missing/suspicious from name
    if (!email.from.name || email.from.name.length < 2) {
      spamScore += 0.1;
      reasons.push('Missing or suspicious sender name');
    }

    return {
      isLikelySpam: spamScore >= 0.5,
      reasons,
      confidence: Math.min(spamScore, 1),
    };
  }
}

// Singleton instance
let parserInstance: EmailParser | null = null;

export function getEmailParser(): EmailParser {
  if (!parserInstance) {
    parserInstance = new EmailParser();
  }
  return parserInstance;
}

export default EmailParser;
