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
  updateDocument 
} from '@/lib/services/firebase-service-manager';

import { 
  Conversation, 
  Message, 
  ConversationParticipant, 
  CreateConversationRequest,
  ConversationFilters,
  PaginationOptions 
} from '@/features/chat/types'
import { Timestamp } from 'firebase-admin/firestore'

export class ConversationService {
  private rtdb = getAdminRtdb()

  async createConversation(data: CreateConversationRequest): Promise<Conversation> {
    const now = Timestamp.now()
    
    // Create conversation document (we'll get the generated ID after creation)
    
    // Set up participants with proper roles
    const participants: ConversationParticipant[] = data.participantIds.map((userId, index) => ({
      userId,
      role: index === 0 ? 'admin' : 'member', // First participant is admin
      joinedAt: now,
      isTyping: false,
      isOnline: false
    }))

    const conversationData = {
      type: data.type,
      participants,
      lastActivity: now,
      isActive: true,
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now
    }

    // Create conversation using optimized function
    const conversationRef = await createDocument('conversations', conversationData)
    
    const conversation: Conversation = {
      ...conversationData,
      id: conversationRef.id
    }

    // Initialize real-time presence data for each participant
    for (const participant of participants) {
      await this.rtdb.ref(`presence/conversations/${conversationRef.id}/${participant.userId}`).set({
        isOnline: false,
        isTyping: false,
        lastSeen: now.toMillis()
      })
    }

    // Send welcome system message if needed
    if (data.type === 'entity' && data.metadata?.entityName) {
      await this.sendSystemMessage(
        conversationRef.id,
        `Welcome to the conversation about ${data.metadata.entityName}`
      )
    }

    return conversation
  }

  async getConversations(
    userId: string, 
    filters?: ConversationFilters,
    pagination?: PaginationOptions
  ): Promise<Conversation[]> {
    // Build query configuration for optimized collection query
    const queryConfig: any = {
      where: [{ field: 'participants', operator: 'array-contains' as const, value: { userId } }],
      orderBy: [{ field: 'lastActivity', direction: 'desc' as const }]
    }

    // Apply filters
    if (filters?.type) {
      queryConfig.where.push({ field: 'type', operator: '==' as const, value: filters.type })
    }
    if (filters?.isActive !== undefined) {
      queryConfig.where.push({ field: 'isActive', operator: '==' as const, value: filters.isActive })
    }

    // Apply pagination
    if (pagination?.limit) {
      queryConfig.limit = pagination.limit
    }
    if (pagination?.cursor) {
      const cursorDoc = await getCachedDocument('conversations', pagination.cursor)
      if (cursorDoc && cursorDoc.exists) {
        queryConfig.startAfter = cursorDoc
      }
    }

    const snapshot = await getCachedCollectionAdvanced('conversations', queryConfig)
    const conversations: Conversation[] = []

    for (const doc of snapshot.docs) {
      const conversation = { id: doc.id, ...doc.data() } as Conversation
      
      // Calculate unread count for this user
      const unreadCount = await this.getUnreadCount(conversation.id, userId)
      
      conversations.push({
        ...conversation,
        unreadCount
      } as Conversation & { unreadCount: number })
    }

    return conversations
  }

  async getConversationById(id: string, userId: string): Promise<Conversation | null> {
    const doc = await getCachedDocument('conversations', id)
    
    if (!doc || !doc.exists) {
      return null
    }

    const conversation = { id: doc.id, ...doc.data() } as Conversation
    
    // Validate user is participant
    const isParticipant = conversation.participants.some(p => p.userId === userId)
    if (!isParticipant) {
      throw new Error('Access denied: User is not a participant in this conversation')
    }

    return conversation
  }

  async addParticipant(conversationId: string, userId: string, role: 'admin' | 'member' | 'observer' = 'member'): Promise<void> {
    const now = Timestamp.now()

    // Check if user is already a participant
    const conversation = await getCachedDocument('conversations', conversationId)
    if (!conversation || !conversation.exists) {
      throw new Error('Conversation not found')
    }

    const data = conversation.data() as Conversation
    const existingParticipant = data.participants.find(p => p.userId === userId)
    
    if (existingParticipant) {
      throw new Error('User is already a participant')
    }

    // Add new participant
    const newParticipant: ConversationParticipant = {
      userId,
      role,
      joinedAt: now,
      isTyping: false,
      isOnline: false
    }

    await updateDocument('conversations', conversationId, {
      participants: [...data.participants, newParticipant],
      updatedAt: now
    })

    // Update real-time presence
    await this.rtdb.ref(`presence/conversations/${conversationId}/${userId}`).set({
      isOnline: false,
      isTyping: false,
      lastSeen: now.toMillis()
    })

    // Send system message about new participant
    await this.sendSystemMessage(
      conversationId,
      `A new participant has joined the conversation`
    )
  }

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    const now = Timestamp.now()

    const conversation = await getCachedDocument('conversations', conversationId)
    if (!conversation || !conversation.exists) {
      throw new Error('Conversation not found')
    }

    const data = conversation.data() as Conversation
    const updatedParticipants = data.participants.filter(p => p.userId !== userId)

    if (updatedParticipants.length === data.participants.length) {
      throw new Error('User is not a participant')
    }

    await updateDocument('conversations', conversationId, {
      participants: updatedParticipants,
      updatedAt: now
    })

    // Clean up real-time presence
    await this.rtdb.ref(`presence/conversations/${conversationId}/${userId}`).remove()

    // Send system message about participant leaving
    await this.sendSystemMessage(
      conversationId,
      `A participant has left the conversation`
    )
  }

  async updateLastRead(conversationId: string, userId: string): Promise<void> {
    const now = Timestamp.now()

    const conversation = await getCachedDocument('conversations', conversationId)
    if (!conversation || !conversation.exists) {
      throw new Error('Conversation not found')
    }

    const data = conversation.data() as Conversation
    const updatedParticipants = data.participants.map(p => 
      p.userId === userId ? { ...p, lastReadAt: now } : p
    )

    await updateDocument('conversations', conversationId, {
      participants: updatedParticipants,
      updatedAt: now
    })
  }

  private async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    // Get user's last read timestamp
    const conversationDoc = await getCachedDocument('conversations', conversationId)
    if (!conversationDoc || !conversationDoc.exists) return 0

    const conversation = conversationDoc.data() as Conversation
    const participant = conversation.participants.find(p => p.userId === userId)
    const lastReadAt = participant?.lastReadAt

    if (!lastReadAt) {
      // Count all messages if never read
      const queryConfig = {
        where: [{ field: 'conversationId', operator: '==' as const, value: conversationId }]
      }
      const messagesSnapshot = await getCachedCollectionAdvanced('messages', queryConfig)
      return messagesSnapshot.size
    }

    // Count messages after last read
    const queryConfig = {
      where: [
        { field: 'conversationId', operator: '==' as const, value: conversationId },
        { field: 'timestamp', operator: '>' as const, value: lastReadAt },
        { field: 'senderId', operator: '!=' as const, value: userId } // Don't count own messages
      ]
    }
    const unreadSnapshot = await getCachedCollectionAdvanced('messages', queryConfig)

    return unreadSnapshot.size
  }

  private async sendSystemMessage(conversationId: string, content: string): Promise<void> {
    const message: Omit<Message, 'id'> = {
      conversationId,
      senderId: 'system',
      senderName: 'System',
      content,
      type: 'system',
      status: 'sent',
      timestamp: Timestamp.now()
    }

    // Create message using optimized function
    await createDocument('messages', message)

    // Update conversation last activity
    await updateDocument('conversations', conversationId, {
      lastActivity: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
  }
} 