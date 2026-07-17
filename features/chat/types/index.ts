// /features/chat/types/index.ts

import type { MediaDerivatives } from '@/lib/file/interfaces/IFileService'

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

/** SSOT conversation type union — include order_lab for CRM Order Lab. */
export type ConversationType =
  | 'direct'
  | 'entity'
  | 'opportunity'
  | 'product'
  | 'group'
  | 'order_lab'

// Enhanced conversation management types
export interface Conversation {
  id: string
  type: ConversationType
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
    /** Group chat display title */
    groupName?: string
    /** Soft-archive: user ids who archived this conversation from their inbox */
    archivedBy?: string[]
    /** Mute notifications: user ids who muted this conversation */
    mutedBy?: string[]
    /** Tool editors (generative gallery, etc.) — hide from main Messages inbox */
    kind?: string
    hiddenFromInbox?: boolean
    /** CRM Order Lab — linked project order id */
    orderId?: string
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
  /** Enriched from users.image / users.photoURL at read time */
  avatarUrl?: string
  displayName?: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  content: string
  type: 'text' | 'image' | 'file' | 'system' | 'payment_request'
  status: 'sending' | 'sent' | 'delivered' | 'read'
  replyTo?: string
  attachments?: MessageAttachment[]
  timestamp: RingTimestamp
  editedAt?: RingTimestamp
  reactions?: MessageReaction[]
  /** Structured payload (e.g. payment_request widget). */
  metadata?: Record<string, unknown>
}

export interface PaymentRequestMetadata {
  kind: 'payment_request'
  amount: string
  tokenSymbol: string
  note?: string
  requesterUserId: string
  requesterWalletAddress: string
  status: 'pending' | 'paid' | 'cancelled'
  paidAt?: string
  paidByUserId?: string
  paidTxHash?: string
  paidWalletTxId?: string
  payNote?: string
  cancelledAt?: string
}

export interface MessageAttachment {
  id: string
  type: 'image' | 'file' | 'document'
  url: string
  name: string
  size: number
  mimeType: string
  /** RingBase UUID when uploaded via /api/uploads. */
  fileId?: string
  /** RingBase derivative ladder (gallery profile for chat images). */
  derivatives?: MediaDerivatives
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
  type: ConversationType
  participantIds: string[]
  /** When set, this user is always assigned admin (group creator). */
  creatorUserId?: string
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
    groupName?: string
    kind?: string
    hiddenFromInbox?: boolean
    orderId?: string
  }
}

export interface SendMessageRequest {
  conversationId: string
  content: string
  type?: 'text' | 'image' | 'file' | 'system' | 'payment_request'
  replyTo?: string
  attachments?: Omit<MessageAttachment, 'id'>[]
  metadata?: Record<string, unknown>
}

export interface ConversationFilters {
  type?: ConversationType
  isActive?: boolean
  entityId?: string
  opportunityId?: string
  productId?: string
  orderId?: string
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
