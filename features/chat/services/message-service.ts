// 🚀 OPTIMIZED SERVICE: Ring-native implementation
// - DatabaseService for persistence (NO Firebase!)
// - Tunnel protocol for real-time updates (replaces Firebase RTDB)
// - React 19 patterns: NO cache() for mutations, revalidatePath()
// - Multi-protocol support: WebSocket/SSE/Supabase/Long-polling based on backend mode

import { db } from '@/lib/database';
import { 
  Message, 
  SendMessageRequest,
  PaginationOptions,
  MessageAttachment
} from '@/features/chat/types'
import { EntityDatabaseError, ValidationError, FetchError, logRingError } from '@/lib/errors'
import { revalidatePath } from 'next/cache';

// Tunnel protocol for real-time (replaces Firebase RTDB)
import { publishToChannel } from '@/lib/tunnel/publisher';
import { ConversationService } from '@/features/chat/services/conversation-service';

export class MessageService {
  private conversationService = new ConversationService();
  // Real-time handled by Tunnel protocol, no RTDB needed

  /**
   * Send a message to a conversation with enhanced error handling
   * @param data - The message data
   * @param senderId - The ID of the sender
   * @param senderName - The name of the sender
   * @param senderAvatar - Optional avatar URL of the sender
   * @returns Promise<Message> - The created message
   * @throws {ValidationError} If required data is missing
   * @throws {EntityDatabaseError} If database operations fail
   */
  async sendMessage(data: SendMessageRequest, senderId: string, senderName: string, senderAvatar?: string): Promise<Message> {
    try {
      // Validate required data
      if (!data.conversationId) {
        throw new ValidationError('Conversation ID is required', undefined, {
          timestamp: Date.now(),
          senderId,
          operation: 'sendMessage'
        });
      }

      if (!data.content && (!data.attachments || data.attachments.length === 0)) {
        throw new ValidationError('Message content or attachments are required', undefined, {
          timestamp: Date.now(),
          senderId,
          conversationId: data.conversationId,
          operation: 'sendMessage'
        });
      }

      const now = new Date();
      
      // Handle file attachments via Vercel Blob if any
      let processedAttachments: MessageAttachment[] = []
      if (data.attachments && data.attachments.length > 0) {
        try {
          processedAttachments = await this.processAttachments(data.attachments)
        } catch (error) {
          throw new EntityDatabaseError(
            'Failed to process message attachments',
            error instanceof Error ? error : new Error(String(error)),
            {
              timestamp: Date.now(),
              senderId,
              conversationId: data.conversationId,
              attachmentCount: data.attachments.length,
              operation: 'process_attachments'
            }
          );
        }
      }

      const messageData = {
        conversationId: data.conversationId,
        senderId,
        senderName,
        senderAvatar,
        content: data.content,
        attachments: processedAttachments,
        timestamp: now,
        status: 'sent' as const,
        type: 'text' as const
      }

      // Save message to database (MUTATION - NO CACHE!)
      const createResult = await db().createDoc('messages', messageData);
      if (!createResult.success || !createResult.data) {
        throw new EntityDatabaseError(
          'Failed to save message to database',
          createResult.error || new Error('Database create failed'),
          {
            timestamp: Date.now(),
            senderId,
            conversationId: data.conversationId,
            operation: 'save_message_database'
          }
        );
      }

      const message = createResult.data as Message;

      // Update conversation last message
      try {
        await this.updateConversationLastMessage(data.conversationId, message)
      } catch (error) {
        // Log but don't fail - this is not critical for message sending
        logRingError(error, `Failed to update conversation last message for ${data.conversationId}`)
      }

      // Trigger real-time update via Tunnel protocol (replaces Firebase RTDB)
      try {
        await publishToChannel(`conversation:${data.conversationId}`, 'message:new', message);
      } catch (error) {
        // Log but don't fail - real-time is nice-to-have
        logRingError(error, `Failed to trigger real-time update for conversation ${data.conversationId}`)
      }

      // Send notifications to participants
      try {
        await this.sendNotificationsToParticipants(data.conversationId, senderId, message)
      } catch (error) {
        // Log but don't fail - this is not critical for message sending
        logRingError(error, `Failed to send notifications for conversation ${data.conversationId}`)
      }
      
      // Revalidate conversation page (React 19 pattern)
      revalidatePath(`/[locale]/chat/${data.conversationId}`);

      return message
    } catch (error) {
      // Enhanced error logging with cause information
      logRingError(error, 'MessageService: sendMessage - Error sending message');
      
      // Re-throw known errors, wrap unknown errors
      if (error instanceof ValidationError || 
          error instanceof EntityDatabaseError ||
          error instanceof FetchError) {
        throw error;
      }
      
      throw new EntityDatabaseError(
        'Unknown error occurred while sending message',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          senderId,
          conversationId: data.conversationId,
          operation: 'sendMessage'
        }
      );
    }
  }

  /**
   * Get messages for a conversation with pagination and enhanced error handling
   * @param conversationId - The conversation ID
   * @param userId - The user ID requesting messages
   * @param pagination - Optional pagination parameters
   * @returns Promise<Message[]> - Array of messages
   * @throws {ValidationError} If required data is missing
   * @throws {EntityDatabaseError} If database operations fail
   */
  async getMessages(conversationId: string, userId: string, pagination?: PaginationOptions): Promise<Message[]> {
    try {
      // Validate required data
      if (!conversationId) {
        throw new ValidationError('Conversation ID is required', undefined, {
          timestamp: Date.now(),
          userId,
          operation: 'getMessages'
        });
      }

      if (!userId) {
        throw new ValidationError('User ID is required', undefined, {
          timestamp: Date.now(),
          conversationId,
          operation: 'getMessages'
        });
      }

      // Verify user has access to this conversation
      try {
        await this.verifyConversationAccess(conversationId, userId);
      } catch (error) {
        throw new EntityDatabaseError(
          'Access denied to conversation',
          error instanceof Error ? error : new Error(String(error)),
          {
            timestamp: Date.now(),
            conversationId,
            userId,
            operation: 'verify_conversation_access'
          }
        );
      }

      const queryResult = await db().queryDocs<Message>({
        collection: 'messages',
        filters: [{ field: 'conversationId', operator: '==', value: conversationId }],
        orderBy: [{ field: 'timestamp', direction: 'desc' }],
        pagination: {
          limit: pagination?.limit || 50,
          offset: (pagination as { offset?: number })?.offset || 0
        }
      });

      if (!queryResult.success || !queryResult.data) {
        throw new EntityDatabaseError(
          'Failed to fetch messages',
          queryResult.error || new Error('Database query failed'),
          {
            timestamp: Date.now(),
            conversationId,
            userId,
            operation: 'fetch_messages'
          }
        );
      }

      const messages = queryResult.data;

      // Mark messages as delivered
      try {
        await this.markMessagesAsDelivered(messages, userId);
      } catch (error) {
        // Log but don't fail - this is not critical
        logRingError(error, `Failed to mark messages as delivered for user ${userId}`);
      }

      return messages.reverse();
    } catch (error) {
      // Enhanced error logging with cause information
      logRingError(error, 'MessageService: getMessages - Error fetching messages');
      
      // Re-throw known errors, wrap unknown errors
      if (error instanceof ValidationError || 
          error instanceof EntityDatabaseError ||
          error instanceof FetchError) {
        throw error;
      }
      
      throw new EntityDatabaseError(
        'Unknown error occurred while fetching messages',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          conversationId,
          userId,
          operation: 'getMessages'
        }
      );
    }
  }

  /**
   * Verify user has access to a conversation
   * @param conversationId - The conversation ID
   * @param userId - The user ID
   * @throws {EntityDatabaseError} If verification fails
   */
  private async verifyConversationAccess(conversationId: string, userId: string): Promise<void> {
    try {
      const readResult = await db().readDoc<{ participants?: Array<{ userId: string }> }>(
        'conversations',
        conversationId
      );
      
      if (!readResult.success || !readResult.data) {
        throw new EntityDatabaseError('Conversation not found', undefined, {
          timestamp: Date.now(),
          conversationId,
          userId,
          operation: 'verifyConversationAccess'
        });
      }

      const conversation = readResult.data;
      const isParticipant = conversation.participants?.some((p) => p.userId === userId);
      
      if (!isParticipant) {
        throw new EntityDatabaseError('Access denied: User is not a participant in this conversation', undefined, {
          timestamp: Date.now(),
          conversationId,
          userId,
          operation: 'verifyConversationAccess'
        });
      }
    } catch (error) {
      if (error instanceof EntityDatabaseError) {
        throw error;
      }
      throw new EntityDatabaseError(
        'Failed to verify conversation access',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          conversationId,
          userId,
          operation: 'verifyConversationAccess'
        }
      );
    }
  }

  /**
   * Mark messages as delivered for a user
   * @param messages - Array of messages to mark as delivered
   * @param userId - The user ID
   * @throws {EntityDatabaseError} If marking fails
   */
  private async markMessagesAsDelivered(messages: Message[], userId: string): Promise<void> {
    try {
      // Update messages in batch (MUTATION - NO CACHE!)
      for (const message of messages) {
        if (message.senderId !== userId && message.status === 'sent') {
          const updateResult = await db().updateDoc('messages', message.id, { status: 'delivered' });
          // Don't throw on individual failures - best effort delivery receipts
          if (!updateResult.success) {
            console.warn(`Failed to mark message ${message.id} as delivered:`, updateResult.error);
          }
        }
      }
    } catch (error) {
      throw new EntityDatabaseError(
        'Failed to mark messages as delivered',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId,
          messageCount: messages.length,
          operation: 'markMessagesAsDelivered'
        }
      );
    }
  }

  /**
   * Process file attachments with error handling
   * @param attachments - Array of attachment data
   * @returns Promise<MessageAttachment[]> - Processed attachments
   * @throws {EntityDatabaseError} If attachment processing fails
   */
  private async processAttachments(attachments: Array<{
    url?: string;
    name?: string;
    size?: number;
    type?: string;
    mimeType?: string;
  }>): Promise<MessageAttachment[]> {
    try {
      // Process each attachment
      const processedAttachments: MessageAttachment[] = []
      
      for (const attachment of attachments) {
        if (!attachment.url) {
          throw new ValidationError('Attachment URL is required', undefined, {
            timestamp: Date.now(),
            attachment,
            operation: 'processAttachments'
          });
        }

        const rawType = attachment.type || 'file'
        const attachmentType: MessageAttachment['type'] =
          rawType === 'image' || rawType === 'document' ? rawType : 'file'

        const processedAttachment: MessageAttachment = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url: attachment.url,
          name: attachment.name || 'unknown',
          size: attachment.size || 0,
          type: attachmentType,
          mimeType: attachment.mimeType || 'application/octet-stream'
        }
        
        processedAttachments.push(processedAttachment)
      }

      return processedAttachments
    } catch (error) {
      throw new EntityDatabaseError(
        'Failed to process message attachments',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          attachmentCount: attachments.length,
          operation: 'processAttachments'
        }
      );
    }
  }

  /**
   * Update conversation with last message information
   * @param conversationId - The conversation ID
   * @param message - The message to set as last message
   * @throws {EntityDatabaseError} If update fails
   */
  private async updateConversationLastMessage(conversationId: string, message: Message): Promise<void> {
    try {
      await this.conversationService.touchLastActivity(conversationId, message);
    } catch (error) {
      throw new EntityDatabaseError(
        'Failed to update conversation last message',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          conversationId,
          messageId: message.id,
          operation: 'updateConversationLastMessage'
        }
      );
    }
  }

  /**
   * Trigger real-time update for message
   * @param conversationId - The conversation ID
   * @param message - The message to broadcast
   * @throws {EntityDatabaseError} If real-time update fails
   */
  private async triggerRealTimeUpdate(conversationId: string, message: Message): Promise<void> {
    try {
      // Use Tunnel protocol for real-time (Ring analog to Firebase RTDB)
      await publishToChannel(`conversation:${conversationId}`, 'message:update', {
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        content: message.content,
        type: message.type,
        timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : message.timestamp,
        status: message.status
      });
    } catch (error) {
      throw new EntityDatabaseError(
        'Failed to trigger real-time update',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          conversationId,
          messageId: message.id,
          operation: 'triggerRealTimeUpdate'
        }
      );
    }
  }

  /**
   * Send notifications to conversation participants
   * @param conversationId - The conversation ID
   * @param senderId - The sender ID
   * @param message - The message to notify about
   * @throws {EntityDatabaseError} If notification sending fails
   */
  private async sendNotificationsToParticipants(conversationId: string, senderId: string, message: Message): Promise<void> {
    try {
      // This is a placeholder for actual notification logic
      console.log(`Would send notification for message: ${message.content}`)
      
      // In a real implementation, this would:
      // 1. Get conversation participants
      // 2. Filter out the sender
      // 3. Send push notifications, emails, etc.
      
    } catch (error) {
      throw new EntityDatabaseError(
        'Failed to send notifications to participants',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          conversationId,
          senderId,
          messageId: message.id,
          operation: 'sendNotificationsToParticipants'
        }
      );
    }
  }

  /**
   * Get a single message by ID
   * @param messageId - The ID of the message to retrieve
   * @returns Promise<Message | null> - The message or null if not found
   * @throws {EntityDatabaseError} If database operations fail
   */
  async getMessage(messageId: string): Promise<Message | null> {
    try {
      const readResult = await db().readDoc<Message>('messages', messageId);
      
      if (!readResult.success || !readResult.data) {
        return null;
      }
      
      return readResult.data;
      
    } catch (error) {
      throw new EntityDatabaseError(
        'Failed to fetch message',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          messageId,
          operation: 'getMessage'
        }
      )
    }
  }

  /**
   * Update a message
   * @param messageId - The ID of the message to update
   * @param updates - The updates to apply
   * @returns Promise<Message> - The updated message
   * @throws {EntityDatabaseError} If database operations fail
   */
  async updateMessage(messageId: string, updates: Partial<Message>): Promise<Message> {
    try {
      const readResult = await db().readDoc<Message>('messages', messageId);
      if (!readResult.success || !readResult.data) {
        throw new ValidationError('Message not found', undefined, {
          timestamp: Date.now(),
          messageId,
          operation: 'updateMessage'
        })
      }
      
      const updateResult = await db().updateDoc('messages', messageId, {
        ...updates,
        editedAt: new Date()
      });
      
      if (!updateResult.success || !updateResult.data) {
        throw updateResult.error || new Error('Failed to update message');
      }
      
      // Trigger real-time update via Tunnel
      await publishToChannel(`message:${messageId}`, 'message:edited', {
        ...updates,
        editedAt: Date.now()
      });
      
      // Revalidate conversation (React 19 pattern)
      if (readResult.data.conversationId) {
        revalidatePath(`/[locale]/chat/${readResult.data.conversationId}`);
      }
      
      return updateResult.data as Message;
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      
      throw new EntityDatabaseError(
        'Failed to update message',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          messageId,
          operation: 'updateMessage'
        }
      )
    }
  }

  /**
   * Delete a message (soft delete)
   * @param messageId - The ID of the message to delete
   * @returns Promise<void>
   * @throws {EntityDatabaseError} If database operations fail
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      const readResult = await db().readDoc<Message>('messages', messageId);
      if (!readResult.success || !readResult.data) {
        throw new ValidationError('Message not found', undefined, {
          timestamp: Date.now(),
          messageId,
          operation: 'deleteMessage'
        })
      }
      
      const conversationId = readResult.data.conversationId;
      
      const updateResult = await db().updateDoc('messages', messageId, {
        content: '[Message deleted]',
        type: 'text',
        deletedAt: new Date(),
        attachments: []
      });
      
      if (!updateResult.success) {
        throw updateResult.error || new Error('Failed to delete message');
      }
      
      // Trigger real-time update via Tunnel
      await publishToChannel(`conversation:${conversationId}`, 'message:deleted', {
        id: messageId,
        content: '[Message deleted]',
        deletedAt: Date.now()
      });
      
      // Revalidate conversation (React 19 pattern)
      revalidatePath(`/[locale]/chat/${conversationId}`);
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      
      throw new EntityDatabaseError(
        'Failed to delete message',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          messageId,
          operation: 'deleteMessage'
        }
      )
    }
  }
}
