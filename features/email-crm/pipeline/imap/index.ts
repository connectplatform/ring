/**
 * IMAP Service Module Export
 * ==========================
 */

export { ImapListener, getImapListener } from './imap-listener'
export type { EmailReceivedEvent, ImapListenerEvents } from './imap-listener'
export {
  emailConfig,
  getPrimaryEmailConfig,
  getChannelById,
  validateEmailConfig,
  validateCrmChannels,
  loadCrmChannels,
} from './config'
export type { EmailConfig, ResolvedCrmChannel, ChannelFlow } from './config'
