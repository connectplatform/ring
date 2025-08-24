// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { getAdminRtdb } from '@/lib/firebase-admin.server'
import { 
  getCachedDocument, 
  getCachedCollectionAdvanced, 
  createDocument, 
  updateDocument,
  runTransaction,
  createBatchWriter,
  executeBatch
} from '@/lib/services/firebase-service-manager';

import { 
  Message, 
  SendMessageRequest,
  PaginationOptions,
  MessageAttachment
} from '@/features/chat/types'
import { Timestamp } from 'firebase-admin/firestore'
import { EntityDatabaseError, ValidationError, FetchError, logRingError } from '@/lib/errors'

export class MessageService {
  private rtdb = getAdminRtdb()

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

      const now = Timestamp.now()
      
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

      // Save message to Firestore using optimized function
      let messageRef;
      try {
        messageRef = await createDocument('messages', messageData)
      } catch (error) {
        throw new EntityDatabaseError(
          'Failed to save message to Firestore',
          error instanceof Error ? error : new Error(String(error)),
          {
            timestamp: Date.now(),
            senderId,
            conversationId: data.conversationId,
            operation: 'save_message_firestore'
          }
        );
      }

      const message: Message = {
        ...messageData,
        id: messageRef.id
      }

      // Update conversation last message
      try {
        await this.updateConversationLastMessage(data.conversationId, message)
      } catch (error) {
        // Log but don't fail - this is not critical for message sending
        logRingError(error, `Failed to update conversation last message for ${data.conversationId}`)
      }

      // Trigger real-time update
      try {
        await this.triggerRealTimeUpdate(data.conversationId, message)
      } catch (error) {
        // Log but don't fail - this is not critical for message sending
        logRingError(error, `Failed to trigger real-time update for conversation ${data.conversationId}`)
      }

      // Send notifications to participants
      try {
        await this.sendNotificationsToParticipants(data.conversationId, senderId, message)
      } catch (error) {
        // Log but don't fail - this is not critical for message sending
        logRingError(error, `Failed to send notifications for conversation ${data.conversationId}`)
      }

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

      // Build query configuration for optimized collection query
      const queryConfig: any = {
        where: [{ field: 'conversationId', operator: '==' as const, value: conversationId }],
        orderBy: [{ field: 'timestamp', direction: 'desc' as const }]
      }

      if (pagination?.limit) {
        queryConfig.limit = pagination.limit;
      }
      
      if (pagination?.cursor) {
        try {
          const cursorDoc = await getCachedDocument('messages', pagination.cursor);
          if (cursorDoc && cursorDoc.exists) {
            if (pagination.direction === 'before') {
              queryConfig.endBefore = cursorDoc;
            } else {
              queryConfig.startAfter = cursorDoc;
            }
          }
        } catch (error) {
          throw new EntityDatabaseError(
            'Failed to apply pagination cursor',
            error instanceof Error ? error : new Error(String(error)),
            {
              timestamp: Date.now(),
              conversationId,
              userId,
              cursor: pagination.cursor,
              operation: 'apply_pagination_cursor'
            }
          );
        }
      }

      // Execute optimized query
      let snapshot;
      try {
        snapshot = await getCachedCollectionAdvanced('messages', queryConfig);
      } catch (error) {
        throw new EntityDatabaseError(
          'Failed to fetch messages',
          error instanceof Error ? error : new Error(String(error)),
          {
            timestamp: Date.now(),
            conversationId,
            userId,
            operation: 'fetch_messages'
          }
        );
      }

      const messages: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];

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
      const conversationDoc = await getCachedDocument('conversations', conversationId);
      
      if (!conversationDoc || !conversationDoc.exists) {
        throw new EntityDatabaseError('Conversation not found', undefined, {
          timestamp: Date.now(),
          conversationId,
          userId,
          operation: 'verifyConversationAccess'
        });
      }

      const conversation = conversationDoc.data();
      const isParticipant = conversation?.participants?.some((p: any) => p.userId === userId);
      
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
      const batch = createBatchWriter();
      let hasUpdates = false;

      for (const message of messages) {
        if (message.senderId !== userId && message.status === 'sent') {
          await updateDocument('messages', message.id, { status: 'delivered' });
          hasUpdates = true;
        }
      }

      // Note: Individual updateDocument calls are used instead of batch for simplicity
      // If performance becomes an issue, we could implement batch updates in firebase-service-manager
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
  private async processAttachments(attachments: any[]): Promise<MessageAttachment[]> {
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

                 const processedAttachment: MessageAttachment = {
           id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
           url: attachment.url,
           name: attachment.name || 'unknown',
           size: attachment.size || 0,
           type: attachment.type || 'unknown',
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
      await updateDocument('conversations', conversationId, {
        lastMessage: {
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          senderName: message.senderName,
          timestamp: message.timestamp,
          type: message.type
        },
        lastActivity: message.timestamp,
        updatedAt: Timestamp.now()
      })
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
      await this.rtdb.ref(`conversations/${conversationId}/messages/${message.id}`).set({
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        content: message.content,
        type: message.type,
        timestamp: message.timestamp.toMillis(),
        status: message.status
      })
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
      const messageDoc = await getCachedDocument('messages', messageId)
      
      if (!messageDoc || !messageDoc.exists) {
        return null
      }
      
      return {
        id: messageDoc.id,
        ...messageDoc.data()
      } as Message
      
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
      const messageDoc = await getCachedDocument('messages', messageId)
      
      if (!messageDoc || !messageDoc.exists) {
        throw new ValidationError('Message not found', undefined, {
          timestamp: Date.now(),
          messageId,
          operation: 'updateMessage'
        })
      }
      
      // Update the message using optimized function
      await updateDocument('messages', messageId, {
        ...updates,
        editedAt: Timestamp.now()
      })
      
      // Update real-time database
      await this.rtdb.ref(`messages/${messageId}`).update({
        ...updates,
        editedAt: Date.now()
      })
      
      // Get and return updated message
      const updatedDoc = await getCachedDocument('messages', messageId)
      return {
        id: updatedDoc.id,
        ...updatedDoc.data()
      } as Message
      
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
      const messageDoc = await getCachedDocument('messages', messageId)
      
      if (!messageDoc || !messageDoc.exists) {
        throw new ValidationError('Message not found', undefined, {
          timestamp: Date.now(),
          messageId,
          operation: 'deleteMessage'
        })
      }
      
      // Soft delete - update content and mark as deleted using optimized function
      await updateDocument('messages', messageId, {
        content: '[Message deleted]',
        type: 'text',
        deletedAt: Timestamp.now(),
        attachments: [] // Remove any attachments
      })
      
      // Update real-time database
      await this.rtdb.ref(`messages/${messageId}`).update({
        content: '[Message deleted]',
        type: 'text',
        deletedAt: Date.now(),
        attachments: []
      })
      
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