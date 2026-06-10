// /features/chat/types/index.ts

// Legacy interface - keeping for backward compatibility
export interface chat {
  id: string;
  participants: string[];
  opportunityId: string;
  messages: {
    id: string;
    senderId: string;
    content: string;
    timestamp: string | Date;
  }[];
}

export type RingTimestamp = string | Date;

// Enhanced conversation management types
export interface Conversation {
  id: string
  type: 'direct' | 'entity' | 'opportunity' | 'product'
  participants: ConversationParticipant[]
  lastMessage?: Message
  lastActivity: RingTimestamp
  isActive: boolean
  unreadCount?: number
  metadata: {
    entityId?: string
    entityName?: string
    opportunityId?: string
    opportunityName?: string
    directUserId?: string
    directUserName?: string
    productId?: string
    productName?: string
    subject?: string
    vendorId?: string
  }
  createdAt: RingTimestamp
  updatedAt: RingTimestamp
}

export interface ConversationParticipant {
  userId: string
  role: 'admin' | 'member' | 'observer'
  joinedAt: RingTimestamp
  lastReadAt?: RingTimestamp
  isTyping: boolean
  isOnline: boolean
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  content: string
  type: 'text' | 'image' | 'file' | 'system'
  status: 'sending' | 'sent' | 'delivered' | 'read'
  replyTo?: string
  attachments?: MessageAttachment[]
  timestamp: RingTimestamp
  editedAt?: RingTimestamp
  reactions?: MessageReaction[]
}

export interface MessageAttachment {
  id: string
  type: 'image' | 'file' | 'document'
  url: string
  name: string
  size: number
  mimeType: string
}

export interface MessageReaction {
  emoji: string
  userId: string
  timestamp: RingTimestamp
}

export interface TypingIndicator {
  conversationId: string
  userId: string
  userName: string
  timestamp: RingTimestamp
}

// Request/Response types for API
export interface CreateConversationRequest {
  type: 'direct' | 'entity' | 'opportunity' | 'product'
  participantIds: string[]
  metadata?: {
    entityId?: string
    entityName?: string
    opportunityId?: string
    opportunityName?: string
    directUserId?: string
    directUserName?: string
    productId?: string
    productName?: string
    subject?: string
    vendorId?: string
  }
}

export interface SendMessageRequest {
  conversationId: string
  content: string
  type?: 'text' | 'image' | 'file' | 'system'
  replyTo?: string
  attachments?: Omit<MessageAttachment, 'id'>[]
}

export interface ConversationFilters {
  type?: 'direct' | 'entity' | 'opportunity' | 'product'
  isActive?: boolean
  entityId?: string
  opportunityId?: string
  productId?: string
  lastActivity?: {
    from?: RingTimestamp
    to?: RingTimestamp
  }
}

export interface PaginationOptions {
  limit?: number
  cursor?: string
  direction?: 'before' | 'after'
}

// Form state types
export interface MessageFormState {
  error?: string
  success?: boolean
  message?: string
}
