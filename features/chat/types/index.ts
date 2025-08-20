// /features/chat/types/index.ts
import type { Timestamp } from 'firebase/firestore';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

// Legacy interface - keeping for backward compatibility
export interface chat {
  id: string;
  participants: string[];
  opportunityId: string;
  messages: {
    id: string;
    senderId: string;
    content: string;
    timestamp: Timestamp;
  }[];
}

// Enhanced conversation management types
export interface Conversation {
  id: string
  type: 'direct' | 'entity' | 'opportunity'
  participants: ConversationParticipant[]
  lastMessage?: Message
  lastActivity: Timestamp | AdminTimestamp
  isActive: boolean
  unreadCount?: number
  metadata: {
    entityId?: string
    entityName?: string  
    opportunityId?: string
    opportunityName?: string
  }
  createdAt: Timestamp | AdminTimestamp
  updatedAt: Timestamp | AdminTimestamp
}

export interface ConversationParticipant {
  userId: string
  role: 'admin' | 'member' | 'observer' 
  joinedAt: Timestamp | AdminTimestamp
  lastReadAt?: Timestamp | AdminTimestamp
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
  timestamp: Timestamp | AdminTimestamp
  editedAt?: Timestamp | AdminTimestamp
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
  timestamp: Timestamp | AdminTimestamp
}

export interface TypingIndicator {
  conversationId: string
  userId: string
  userName: string
  timestamp: Timestamp | AdminTimestamp
}

// Request/Response types for API
export interface CreateConversationRequest {
  type: 'direct' | 'entity' | 'opportunity'
  participantIds: string[]
  metadata?: {
    entityId?: string
    entityName?: string
    opportunityId?: string
    opportunityName?: string
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
  type?: 'direct' | 'entity' | 'opportunity'
  isActive?: boolean
  lastActivity?: {
    from?: Timestamp
    to?: Timestamp
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