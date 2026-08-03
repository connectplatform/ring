// /features/chat/types/index.ts

import type { MediaDerivatives } from '@/lib/file/interfaces/IFileService'
import type { ValueDenomination } from '@/lib/value-denomination'

export type { ValueDenomination }

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

/** SSOT conversation type union — include order_lab + support for CRM. */
export type ConversationType =
  | 'direct'
  | 'entity'
  | 'opportunity'
  | 'product'
  | 'group'
  | 'order_lab'
  | 'support'

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
    meetupId?: string
    meetupName?: string
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
    /** CRM support request — email-crm thread / contact-form id */
    supportRequestId?: string
    /** Ring user who opened the support request */
    requesterUserId?: string
    /** Prefer in-app chat over email for this support thread */
    preferChat?: boolean
    /** Linked email-crm contact id */
    emailContactId?: string
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

/** Canonical Message.type SSOT — keep in sync with API validTypes + interactive kit. */
export type MessageType =
  | 'text'
  | 'image'
  | 'file'
  | 'system'
  | 'payment_request'
  | 'env_request'
  | 'task'
  | 'poll'
  | 'rsvp'
  | 'dao_jar'
  | 'share_card'
  | 'game_request'
  | 'cart_summary'
  | 'product_card'

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  content: string
  type: MessageType
  status: 'sending' | 'sent' | 'delivered' | 'read'
  replyTo?: string
  attachments?: MessageAttachment[]
  timestamp: RingTimestamp
  editedAt?: RingTimestamp
  reactions?: MessageReaction[]
  /** Structured payload (e.g. payment_request widget). Generative kinds stay metadata-only on text/image. */
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

export interface EnvRequestMetadata {
  kind: 'env_request'
  keys: string[]
  docsPath?: string
  status: 'pending' | 'fulfilled' | 'cancelled'
  requesterUserId: string
  orderId: string
  fulfilledAt?: string
  cancelledAt?: string
}

export type TaskStatus =
  | 'available'
  | 'requested'
  | 'in_progress'
  | 'completed'
  | 'accepted'
  | 'canceled'
  | 'disputed'

export interface TaskMetadata {
  kind: 'task'
  reporterUserId: string
  assigneeUserId: string | null
  status: TaskStatus
  deadline?: string
  budget?: {
    amount: number
    currencyType: ValueDenomination
    /** Explicit code override; defaults to the project main currency / native token symbol. */
    currencyCode?: string
    displayUnit: ValueDenomination
  }
  escrow?: {
    enabled: boolean
    escrowId?: string
    paymentStatus: 'none' | 'pending' | 'held' | 'released' | 'refunded' | 'failed'
    payment_data?: {
      type: string
      transactionId?: string
      orderReference?: string
      status: string
    }
  }
  startedAt?: string
  completedAt?: string
  acceptedAt?: string
  canceledAt?: string
  disputedAt?: string
  requestedByUserId?: string
  opportunityId?: string
  audit?: Array<{ at: string; by: string; action: string; from?: string; to?: string }>
}

export interface PollMetadata {
  kind: 'poll'
  question: string
  options: Array<{ id: string; label: string }>
  allowMultiple: boolean
  closeAt?: string
  status: 'open' | 'closed' | 'cancelled'
  votes: Record<string, string[]>
  createdByUserId: string
}

export interface RsvpMetadata {
  kind: 'rsvp'
  title: string
  binding: {
    targetType: 'meetup' | 'entity' | 'group' | 'opportunity'
    targetId: string
  }
  startsAt?: string
  locationLabel?: string
  status: 'open' | 'closed' | 'cancelled'
  responses: Record<string, 'going' | 'maybe' | 'declined'>
  createdByUserId: string
}

export interface DaoJarMetadata {
  kind: 'dao_jar'
  poolId: string
  poolSlug: string
  title: string
  goalRing: string
  pledgedRing: string
  fundingMode: 'donation' | 'escrow'
  status: 'open' | 'queued' | 'in_progress' | 'completed' | 'cancelled'
  contributorUserIds?: string[]
  lastContribution?: {
    userId: string
    amountNativeToken: string
    rail: 'native_token' | 'card'
    at: string
  }
}

/** Peer mini-game challenge in chat — see features/peer-games. */
export interface GameRequestMetadata {
  kind: 'game_request'
  slug: 'tic-tac-toe' | 'chess' | string
  sessionId: string
  status: 'pending' | 'active' | 'completed' | 'declined' | 'resigned'
  challengerUserId: string
  peerUserId: string
  winnerUserId?: string | null
  title?: string
}

export interface ShareCardMetadata {
  kind: 'share_card'
  targetType:
    | 'future_feature'
    | 'dao_pool'
    | 'entity'
    | 'opportunity'
    | 'product'
    | 'source_commit'
  targetId: string
  title: string
  description?: string
  url: string
  previewImage?: string
  /** Order Source Editor commit card payload (when targetType === 'source_commit'). */
  commit?: {
    sha: string
    path: string
    orderId: string
    /** Buyer-facing order URL (Open uses this when session user is the buyer). */
    buyerUrl?: string
    buyerId?: string
    integratorId?: string
  }
}

/** Commerce product embed — CRM-hydrated snapshot (never trust LLM price). */
export interface ProductCardMetadata {
  kind: 'product_card'
  productId: string
  title: string
  url: string
  description?: string
  previewImage?: string
  price: string
  currency: string
  inStock?: boolean
  vendorName?: string
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
    supportRequestId?: string
    requesterUserId?: string
    preferChat?: boolean
    emailContactId?: string
  }
}

export interface SendMessageRequest {
  conversationId: string
  content: string
  type?: MessageType
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
