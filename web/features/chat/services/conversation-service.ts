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

/** Generative gallery / tool-editor chats must not pollute Messages inbox. */
export function isHiddenToolConversation(conversation: Conversation): boolean {
  const meta = conversation.metadata
  if (!meta) return false
  if (meta.hiddenFromInbox === true) return true
  if (meta.kind === 'generative_gallery') return true
  const productId = meta.productId || ''
  const subject = meta.subject || ''
  return (
    productId.startsWith('imggen:') ||
    productId.startsWith('genmedia:') ||
    subject.startsWith('imggen:') ||
    subject.startsWith('genmedia:')
  )
}

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

  async findOrderLabConversation(orderId: string): Promise<Conversation | null> {
    const result = await db().queryDocs<Conversation>({
      collection: 'conversations',
      filters: [
        { field: 'type', operator: '==', value: 'order_lab' },
        { field: 'metadata', operator: 'jsonb-contains', value: { orderId } },
      ],
      orderBy: [{ field: 'updated_at', direction: 'desc' }],
      pagination: { limit: 1 },
    });

    if (!result.success || !result.data?.length) {
      return null;
    }

    return result.data[0];
  }

  async findSupportConversation(supportRequestId: string): Promise<Conversation | null> {
    const result = await db().queryDocs<Conversation>({
      collection: 'conversations',
      filters: [
        { field: 'type', operator: '==', value: 'support' },
        { field: 'metadata', operator: 'jsonb-contains', value: { supportRequestId } },
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
    const creatorUserId = data.creatorUserId || participantIds[0];

    if (data.type === 'group') {
      const groupName = data.metadata?.groupName?.trim();
      if (!groupName) {
        throw new Error('groupName is required for group conversations');
      }
      if (participantIds.length < 2) {
        throw new Error('Group conversations require the creator and at least one other participant');
      }
      data.metadata = { ...data.metadata, groupName };
    }

    if (data.type === 'direct' && participantIds.length >= 2) {
      const [first, second] = participantIds;
      const { isDirectMessagingBlockedBetween } = await import(
        '@/features/auth/services/user-blocklist-lib'
      );
      if (await isDirectMessagingBlockedBetween(first, second)) {
        throw new Error('Direct messaging unavailable between these users');
      }
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

    if (data.type === 'order_lab' && data.metadata?.orderId) {
      const existing = await this.findOrderLabConversation(data.metadata.orderId);
      if (existing) {
        return existing;
      }
    }

    if (data.type === 'support' && data.metadata?.supportRequestId) {
      const existing = await this.findSupportConversation(data.metadata.supportRequestId);
      if (existing) {
        return existing;
      }
    }

    const participants: ConversationParticipant[] = participantIds.map((userId) => ({
      userId,
      role: userId === creatorUserId ? 'admin' : 'member',
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

    if (data.type === 'group' && data.metadata?.groupName) {
      await this.sendSystemMessage(
        conversation.id,
        `Group “${data.metadata.groupName}” created`,
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
      // Soft-archived conversations stay out of the default inbox
      if (conversation.metadata?.archivedBy?.includes(userId)) {
        continue;
      }
      // Generative gallery / tool-editor chats stay out of Messages inbox
      if (isHiddenToolConversation(conversation)) {
        continue;
      }
      const unreadCount = await this.getUnreadCount(conversation.id, userId);
      const enriched = await this.enrichParticipants(conversation, userId);
      conversations.push({ ...enriched, unreadCount });
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

    return this.enrichParticipants(conversation, userId);
  }

  /**
   * Enrich participants with avatarUrl / displayName from users collection
   * (users.image or users.photoURL — Auth.js / Google profile photo).
   */
  private async enrichParticipants(
    conversation: Conversation,
    viewerUserId?: string,
  ): Promise<Conversation> {
    const participants = await Promise.all(
      conversation.participants.map(async (participant) => {
        if (participant.avatarUrl && participant.displayName) {
          return participant;
        }
        try {
          const userResult = await db().readDoc<{
            image?: string
            photoURL?: string
            name?: string
            username?: string
          }>('users', participant.userId);
          if (!userResult.success || !userResult.data) {
            return participant;
          }
          const user = userResult.data;
          const avatarUrl = user.image || user.photoURL || participant.avatarUrl;
          const displayName =
            user.name || user.username || participant.displayName;
          return {
            ...participant,
            ...(avatarUrl ? { avatarUrl } : {}),
            ...(displayName ? { displayName } : {}),
          };
        } catch {
          return participant;
        }
      }),
    );

    const metadata = { ...conversation.metadata };
    if (conversation.type === 'direct' && !metadata.directUserName) {
      const other =
        (metadata.directUserId
          ? participants.find((p) => p.userId === metadata.directUserId)
          : undefined) ||
        (viewerUserId
          ? participants.find((p) => p.userId !== viewerUserId)
          : undefined);
      if (other?.displayName) {
        metadata.directUserName = other.displayName;
      }
    }

    return { ...conversation, participants, metadata };
  }

  async setArchived(
    conversationId: string,
    userId: string,
    archived: boolean,
  ): Promise<Conversation> {
    const conversation = await this.requireParticipant(conversationId, userId);
    const archivedBy = new Set(conversation.metadata?.archivedBy ?? []);
    if (archived) {
      archivedBy.add(userId);
    } else {
      archivedBy.delete(userId);
    }
    await this.updateConversation(conversationId, userId, {
      metadata: {
        ...conversation.metadata,
        archivedBy: Array.from(archivedBy),
      },
    });
    return this.getConversationById(conversationId, userId) as Promise<Conversation>;
  }

  async setMuted(
    conversationId: string,
    userId: string,
    muted: boolean,
  ): Promise<Conversation> {
    const conversation = await this.requireParticipant(conversationId, userId);
    const mutedBy = new Set(conversation.metadata?.mutedBy ?? []);
    if (muted) {
      mutedBy.add(userId);
    } else {
      mutedBy.delete(userId);
    }
    await this.updateConversation(conversationId, userId, {
      metadata: {
        ...conversation.metadata,
        mutedBy: Array.from(mutedBy),
      },
    });
    return this.getConversationById(conversationId, userId) as Promise<Conversation>;
  }

  async markUnread(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.requireParticipant(conversationId, userId);
    const updatedParticipants = conversation.participants.map((p) =>
      p.userId === userId ? { ...p, lastReadAt: undefined } : p,
    );
    await this.updateConversation(conversationId, userId, {
      participants: updatedParticipants,
    });
  }

  private async requireParticipant(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const readResult = await db().readDoc<Conversation>('conversations', conversationId);
    if (!readResult.success || !readResult.data) {
      throw new Error('Conversation not found');
    }
    const conversation = readResult.data;
    if (!conversation.participants.some((p) => p.userId === userId)) {
      throw new Error('Access denied: User is not a participant in this conversation');
    }
    return conversation;
  }

  async addParticipant(
    conversationId: string,
    userId: string,
    role: 'admin' | 'member' | 'observer' = 'member',
    actorUserId?: string,
  ): Promise<void> {
    const now = new Date();

    const readResult = await db().readDoc<Conversation>('conversations', conversationId);

    if (!readResult.success || !readResult.data) {
      throw new Error('Conversation not found');
    }

    const data = readResult.data;

    if (actorUserId) {
      const actor = data.participants.find((p) => p.userId === actorUserId);
      if (!actor) {
        throw new Error('Access denied: User is not a participant in this conversation');
      }
      if (actor.role !== 'admin') {
        throw new Error('Access denied: Only admins can add participants');
      }
    }

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

    const enriched = await this.enrichParticipants(
      { ...data, participants: [...data.participants, newParticipant] },
      actorUserId,
    );
    const joined = enriched.participants.find((p) => p.userId === userId);
    const label = joined?.displayName || userId;
    await this.sendSystemMessage(conversationId, `${label} joined the conversation`);
  }

  async removeParticipant(
    conversationId: string,
    userId: string,
    actorUserId?: string,
  ): Promise<void> {
    const now = new Date();

    const readResult = await db().readDoc<Conversation>('conversations', conversationId);

    if (!readResult.success || !readResult.data) {
      throw new Error('Conversation not found');
    }

    const data = readResult.data;
    const isSelfLeave = actorUserId === userId;

    if (actorUserId && !isSelfLeave) {
      const actor = data.participants.find((p) => p.userId === actorUserId);
      if (!actor) {
        throw new Error('Access denied: User is not a participant in this conversation');
      }
      if (actor.role !== 'admin') {
        throw new Error('Access denied: Only admins can remove other participants');
      }
    }

    const leaving = data.participants.find((p) => p.userId === userId);
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

    const label = leaving?.displayName || userId;
    await this.sendSystemMessage(
      conversationId,
      isSelfLeave ? `${label} left the conversation` : `${label} was removed from the conversation`,
    );
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

  private async sendSystemMessage(
    conversationId: string,
    content: string,
  ): Promise<Message | null> {
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
      // UPGRADE: batch system + media events through a single outbox for Connect hub.
      try {
        await publishToChannel(`conversation:${conversationId}`, 'message:new', createResult.data);
      } catch {
        /* non-fatal */
      }
      return createResult.data as Message;
    }
    return null;
  }

  /**
   * Public wrapper for call lifecycle system lines (invite / ended).
   * Returns the persisted Message so HTTP callers can append locally (mirrors sendMessage).
   * UPGRADE: localize content server-side via next-intl once call i18n keys are shared.
   */
  async recordCallSystemMessage(
    conversationId: string,
    actorUserId: string,
    actionPhrase: string,
  ): Promise<Message | null> {
    const conversation = await this.getConversationById(conversationId, actorUserId);
    if (!conversation) return null;
    const actor =
      conversation.participants.find((p) => p.userId === actorUserId)?.displayName ||
      'Someone';
    return this.sendSystemMessage(conversationId, `${actor} ${actionPhrase}`);
  }
}
