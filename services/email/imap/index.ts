/**
 * IMAP Service Module Export
 * ==========================
 */

export { ImapListener, getImapListener } from './imap-listener';
export type { EmailReceivedEvent, ImapListenerEvents } from './imap-listener';
export { emailConfig, validateEmailConfig, envTemplate } from './config';
export type { EmailConfig } from './config';
