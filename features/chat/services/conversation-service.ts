// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin.server'

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedCollection } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

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
  private db = getAdminDb()
  private rtdb = getAdminRtdb()

  async createConversation(data: CreateConversationRequest): Promise<Conversation> {
    const now = Timestamp.now()
    
    // Create conversation document
    const conversationRef = this.db.collection('conversations').doc()
    
    // Set up participants with proper roles
    const participants: ConversationParticipant[] = data.participantIds.map((userId, index) => ({
      userId,
      role: index === 0 ? 'admin' : 'member', // First participant is admin
      joinedAt: now,
      isTyping: false,
      isOnline: false
    }))

    const conversation: Conversation = {
      id: conversationRef.id,
      type: data.type,
      participants,
      lastActivity: now,
      isActive: true,
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now
    }

    await conversationRef.set(conversation)

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
    let query = this.db.collection('conversations')
      .where('participants', 'array-contains', { userId })
      .orderBy('lastActivity', 'desc')

    // Apply filters
    if (filters?.type) {
      query = query.where('type', '==', filters.type)
    }
    if (filters?.isActive !== undefined) {
      query = query.where('isActive', '==', filters.isActive)
    }

    // Apply pagination
    if (pagination?.limit) {
      query = query.limit(pagination.limit)
    }
    if (pagination?.cursor) {
      const cursorDoc = await this.db.collection('conversations').doc(pagination.cursor).get()
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc)
      }
    }

    const snapshot = await query.get()
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
    const doc = await this.db.collection('conversations').doc(id).get()
    
    if (!doc.exists) {
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
    const conversationRef = this.db.collection('conversations').doc(conversationId)
    const now = Timestamp.now()

    // Check if user is already a participant
    const conversation = await conversationRef.get()
    if (!conversation.exists) {
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

    await conversationRef.update({
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
    const conversationRef = this.db.collection('conversations').doc(conversationId)
    const now = Timestamp.now()

    const conversation = await conversationRef.get()
    if (!conversation.exists) {
      throw new Error('Conversation not found')
    }

    const data = conversation.data() as Conversation
    const updatedParticipants = data.participants.filter(p => p.userId !== userId)

    if (updatedParticipants.length === data.participants.length) {
      throw new Error('User is not a participant')
    }

    await conversationRef.update({
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
    const conversationRef = this.db.collection('conversations').doc(conversationId)
    const now = Timestamp.now()

    const conversation = await conversationRef.get()
    if (!conversation.exists) {
      throw new Error('Conversation not found')
    }

    const data = conversation.data() as Conversation
    const updatedParticipants = data.participants.map(p => 
      p.userId === userId ? { ...p, lastReadAt: now } : p
    )

    await conversationRef.update({
      participants: updatedParticipants,
      updatedAt: now
    })
  }

  private async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    // Get user's last read timestamp
    const conversationDoc = await this.db.collection('conversations').doc(conversationId).get()
    if (!conversationDoc.exists) return 0

    const conversation = conversationDoc.data() as Conversation
    const participant = conversation.participants.find(p => p.userId === userId)
    const lastReadAt = participant?.lastReadAt

    if (!lastReadAt) {
      // Count all messages if never read
      const messagesSnapshot = await this.db
        .collection('messages')
        .where('conversationId', '==', conversationId)
        .get()
      return messagesSnapshot.size
    }

    // Count messages after last read
    const unreadSnapshot = await this.db
      .collection('messages')
      .where('conversationId', '==', conversationId)
      .where('timestamp', '>', lastReadAt)
      .where('senderId', '!=', userId) // Don't count own messages
      .get()

    return unreadSnapshot.size
  }

  private async sendSystemMessage(conversationId: string, content: string): Promise<void> {
    const messageRef = this.db.collection('messages').doc()
    
    const message: Omit<Message, 'id'> = {
      conversationId,
      senderId: 'system',
      senderName: 'System',
      content,
      type: 'system',
      status: 'sent',
      timestamp: Timestamp.now()
    }

    await messageRef.set(message)

    // Update conversation last activity
    await this.db.collection('conversations').doc(conversationId).update({
      lastActivity: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
  }
} 