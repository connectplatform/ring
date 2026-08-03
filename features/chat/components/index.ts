export { MessageBubble } from './message-bubble'
export { TypingIndicator } from './typing-indicator'  
export { MessageComposer } from './message-composer'
export { ConversationHeader } from './conversation-header'
export { CallOverlay } from './call-overlay'
export { MessageThread } from './message-thread'
export { ConversationList } from './conversation-list'
export {
  EmbeddedConversation,
  LabThread,
} from './embedded-conversation'
export type { EmbeddedConversationVariant } from './embedded-conversation'

// Re-export types for convenience
export type { Message, Conversation, ConversationParticipant, TypingIndicator as TypingIndicatorType } from '@/features/chat/types' 