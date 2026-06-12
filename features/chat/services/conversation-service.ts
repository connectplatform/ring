import { db } from '@/lib/database';
import { publishToChannel } from '@/lib/tunnel/publisher';
import {
  Conversation,
  Message,
  ConversationParticipant,
  CreateConversationRequest,
  ConversationFilters,
  PaginationOptions,
} from '@/features/chat/types';

export class ConversationService {
  async findDirectConversation(userIdA: string, userIdB: string): Promise<Conversation | null> {
    const result = await db().queryDocs<Conversation>({
      collection: 'conversations',
      filters: [
        { field: 'type', operator: '==', value: 'direct' },
        { field: 'participants', operator: 'jsonb-contains', value: [{ userId: userIdA }] },
        { field: 'participants', operator: 'jsonb-contains', value: [{ userId: userIdB }] },
      ],
      orderBy: [{ field: 'updated_at', direction: 'desc' }],
      pagination: { limit: 1 },
    });

    if (!result.success || !result.data?.length) {
      return null;
    }

    return result.data[0];
  }

  async findProductConversation(userId: string, productId: string): Promise<Conversation | null> {
    const result = await db().queryDocs<Conversation>({
      collection: 'conversations',
      filters: [
        { field: 'type', operator: '==', value: 'product' },
        { field: 'participants', operator: 'jsonb-contains', value: [{ userId }] },
        { field: 'metadata', operator: 'jsonb-contains', value: { productId } },
      ],
      orderBy: [{ field: 'updated_at', direction: 'desc' }],
      pagination: { limit: 1 },
    });

    if (!result.success || !result.data?.length) {
      return null;
    }

    return result.data[0];
  }

  async createConversation(data: CreateConversationRequest): Promise<Conversation> {
    const now = new Date();

    const participantIds = [...new Set(data.participantIds.filter(Boolean))];

    if (data.type === 'direct' && participantIds.length >= 2) {
      const [first, second] = participantIds;
      const existing = await this.findDirectConversation(first, second);
      if (existing) {
        return existing;
      }
    }

    if (data.type === 'product' && data.metadata?.productId) {
      const ownerId = participantIds[0];
      if (ownerId) {
        const existing = await this.findProductConversation(ownerId, data.metadata.productId);
        if (existing) {
          return existing;
        }
      }
    }

    const participants: ConversationParticipant[] = participantIds.map((userId, index) => ({
      userId,
      role: index === 0 ? 'admin' : 'member',
      joinedAt: now,
      isTyping: false,
      isOnline: false,
    }));

    const conversationData: Omit<Conversation, 'id'> = {
      type: data.type,
      participants,
      lastActivity: now,
      isActive: true,
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    const createResult = await db().createDoc('conversations', conversationData);
    if (!createResult.success || !createResult.data) {
      throw new Error(createResult.error?.message || 'Failed to create conversation');
    }

    const conversation = createResult.data;

    for (const participantId of participantIds) {
      try {
        await publishToChannel(`user:${participantId}`, 'conversation:new', conversation);
      } catch (error) {
        console.warn(`Failed to publish conversation:new for user:${participantId}`, error);
      }
    }

    if (data.type === 'entity' && data.metadata?.entityName) {
      await this.sendSystemMessage(
        conversation.id,
        `Welcome to the conversation about ${data.metadata.entityName}`,
      );
    }

    return conversation;
  }

  async getConversations(
    userId: string,
    filters?: ConversationFilters,
    pagination?: PaginationOptions,
  ): Promise<Conversation[]> {
    const queryFilters: Array<{ field: string; operator: string; value: unknown }> = [
      { field: 'participants', operator: 'jsonb-contains', value: [{ userId }] },
    ];

    if (filters?.type) {
      queryFilters.push({ field: 'type', operator: '==', value: filters.type });
    }
    if (filters?.isActive !== undefined) {
      queryFilters.push({ field: 'isActive', operator: '==', value: filters.isActive });
    }
    if (filters?.entityId) {
      queryFilters.push({
        field: 'metadata',
        operator: 'jsonb-contains',
        value: { entityId: filters.entityId },
      });
    }
    if (filters?.opportunityId) {
      queryFilters.push({
        field: 'metadata',
        operator: 'jsonb-contains',
        value: { opportunityId: filters.opportunityId },
      });
    }
    if (filters?.productId) {
      queryFilters.push({
        field: 'metadata',
        operator: 'jsonb-contains',
        value: { productId: filters.productId },
      });
    }

    if (pagination?.cursor) {
      const cursorRead = await db().readDoc<Conversation>('conversations', pagination.cursor);
      if (cursorRead.success && cursorRead.data?.updatedAt) {
        queryFilters.push({
          field: 'updated_at',
          operator: '<',
          value: cursorRead.data.updatedAt,
        });
      }
    }

    const limit = pagination?.limit ?? 20;

    const result = await db().queryDocs<Conversation>({
      collection: 'conversations',
      filters: queryFilters,
      orderBy: [{ field: 'updated_at', direction: 'desc' }],
      pagination: { limit },
    });

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to fetch conversations');
    }

    const conversations: Conversation[] = [];

    for (const conversation of result.data) {
      const unreadCount = await this.getUnreadCount(conversation.id, userId);
      conversations.push({ ...conversation, unreadCount });
    }

    return conversations;
  }

  async getConversationById(id: string, userId: string): Promise<Conversation | null> {
    const readResult = await db().readDoc<Conversation>('conversations', id);
    if (!readResult.success || !readResult.data) {
      return null;
    }

    const conversation = readResult.data;
    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new Error('Access denied: User is not a participant in this conversation');
    }

    return conversation;
  }

  async addParticipant(
    conversationId: string,
    userId: string,
    role: 'admin' | 'member' | 'observer' = 'member',
  ): Promise<void> {
    const now = new Date();

    const readResult = await db().readDoc<Conversation>('conversations', conversationId);

    if (!readResult.success || !readResult.data) {
      throw new Error('Conversation not found');
    }

    const data = readResult.data;
    const existingParticipant = data.participants.find((p) => p.userId === userId);

    if (existingParticipant) {
      throw new Error('User is already a participant');
    }

    const newParticipant: ConversationParticipant = {
      userId,
      role,
      joinedAt: now,
      isTyping: false,
      isOnline: false,
    };

    const updateResult = await db().updateDoc('conversations', conversationId, {
      participants: [...data.participants, newParticipant],
      updatedAt: now,
    });

    if (!updateResult.success) {
      throw new Error(updateResult.error?.message || 'Failed to add participant');
    }

    await this.sendSystemMessage(conversationId, 'A new participant has joined the conversation');
  }

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    const now = new Date();

    const readResult = await db().readDoc<Conversation>('conversations', conversationId);

    if (!readResult.success || !readResult.data) {
      throw new Error('Conversation not found');
    }

    const data = readResult.data;
    const updatedParticipants = data.participants.filter((p) => p.userId !== userId);

    if (updatedParticipants.length === data.participants.length) {
      throw new Error('User is not a participant');
    }

    const updateResult = await db().updateDoc('conversations', conversationId, {
      participants: updatedParticipants,
      updatedAt: now,
    });

    if (!updateResult.success) {
      throw new Error(updateResult.error?.message || 'Failed to remove participant');
    }

    await this.sendSystemMessage(conversationId, 'A participant has left the conversation');
  }

  async updateLastRead(conversationId: string, userId: string): Promise<void> {
    const now = new Date();

    const readResult = await db().readDoc<Conversation>('conversations', conversationId);

    if (!readResult.success || !readResult.data) {
      throw new Error('Conversation not found');
    }

    const data = readResult.data;
    const updatedParticipants = data.participants.map((p) =>
      p.userId === userId ? { ...p, lastReadAt: now } : p,
    );

    await this.updateConversation(conversationId, userId, {
      participants: updatedParticipants,
      updatedAt: now,
    });
  }

  async updateConversation(
    conversationId: string,
    userId: string,
    updates: Partial<Conversation>,
  ): Promise<void> {
    const readResult = await db().readDoc<Conversation>('conversations', conversationId);
    if (!readResult.success || !readResult.data) {
      throw new Error('Conversation not found');
    }

    const existing = readResult.data;
    const isParticipant = existing.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new Error('Access denied: User is not a participant in this conversation');
    }

    const updateResult = await db().updateDoc('conversations', conversationId, {
      ...updates,
      updatedAt: new Date(),
    });

    if (!updateResult.success) {
      throw new Error(updateResult.error?.message || 'Failed to update conversation');
    }
  }

  async touchLastActivity(conversationId: string, lastMessage: Message): Promise<void> {
    const updateResult = await db().updateDoc('conversations', conversationId, {
      lastMessage: {
        id: lastMessage.id,
        content: lastMessage.content,
        senderId: lastMessage.senderId,
        senderName: lastMessage.senderName,
        timestamp: lastMessage.timestamp,
        type: lastMessage.type,
      },
      lastActivity: lastMessage.timestamp,
      updatedAt: new Date(),
    });

    if (!updateResult.success) {
      throw new Error(updateResult.error?.message || 'Failed to touch conversation activity');
    }
  }

  private async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    const readResult = await db().readDoc<Conversation>('conversations', conversationId);
    if (!readResult.success || !readResult.data) {
      return 0;
    }

    const conversation = readResult.data;
    const participant = conversation.participants.find((p) => p.userId === userId);
    const lastReadAt = participant?.lastReadAt;

    const messageFilters: Array<{ field: string; operator: string; value: unknown }> = [
      { field: 'conversationId', operator: '==', value: conversationId },
      { field: 'senderId', operator: '!=', value: userId },
    ];

    if (lastReadAt) {
      messageFilters.push({ field: 'timestamp', operator: '>', value: lastReadAt });
    }

    const countResult = await db().countDocs('messages', messageFilters);
    if (!countResult.success) {
      return 0;
    }

    return countResult.data ?? 0;
  }

  private async sendSystemMessage(conversationId: string, content: string): Promise<void> {
    const now = new Date();

    const message: Omit<Message, 'id'> = {
      conversationId,
      senderId: 'system',
      senderName: 'System',
      content,
      type: 'system',
      status: 'sent',
      timestamp: now,
    };

    const createResult = await db().createDoc('messages', message);
    if (createResult.success && createResult.data) {
      await this.touchLastActivity(conversationId, createResult.data);
    }
  }
}
