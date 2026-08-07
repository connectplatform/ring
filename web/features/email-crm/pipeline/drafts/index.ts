/**
 * Email Draft Module
 * ==================
 */

export { EmailDraftService, getEmailDraftService, InMemoryDraftRepository } from './draft-service';
export type { 
  EmailDraft, 
  DraftStatus, 
  DraftCreateInput, 
  DraftUpdateInput,
  DraftApprovalResult,
  AutoSendConfig,
  DraftRepository
} from './draft-service';
