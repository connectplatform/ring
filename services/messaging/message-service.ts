import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin.server'
import { 
  Message, 
  SendMessageRequest,
  PaginationOptions,
  MessageAttachment
} from '@/features/chat/types'
import { Timestamp } from 'firebase-admin/firestore'

export class MessageService {
  private db = getAdminDb()
  private rtdb = getAdminRtdb()

  async sendMessage(data: SendMessageRequest, senderId: string, senderName: string, senderAvatar?: string): Promise<Message> {
    const now = Timestamp.now()
    const messageRef = this.db.collection('messages').doc()
    
    // Handle file attachments via Vercel Blob if any
    let processedAttachments: MessageAttachment[] = []
    if (data.attachments && data.attachments.length > 0) {
      processedAttachments = await this.processAttachments(data.attachments)
    }

    const message: Message = {
      id: messageRef.id,
      conversationId: data.conversationId,
      senderId,
      senderName,
      senderAvatar,
      content: data.content,
      type: data.type || 'text',
      status: 'sent',
      replyTo: data.replyTo,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
      timestamp: now
    }

    await messageRef.set(message)
    await this.updateConversationActivity(data.conversationId, message)
    await this.triggerRealTimeUpdate(data.conversationId, message)
    await this.sendNotificationsToParticipants(data.conversationId, senderId, message)

    return message
  }

  async getMessages(conversationId: string, userId: string, pagination?: PaginationOptions): Promise<Message[]> {
    await this.verifyConversationAccess(conversationId, userId)

    let query = this.db.collection('messages')
      .where('conversationId', '==', conversationId)
      .orderBy('timestamp', 'desc')

    if (pagination?.limit) {
      query = query.limit(pagination.limit)
    }
    
    if (pagination?.cursor) {
      const cursorDoc = await this.db.collection('messages').doc(pagination.cursor).get()
      if (cursorDoc.exists) {
        if (pagination.direction === 'before') {
          query = query.endBefore(cursorDoc)
        } else {
          query = query.startAfter(cursorDoc)
        }
      }
    }

    const snapshot = await query.get()
    const messages: Message[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Message[]

    await this.markMessagesAsDelivered(messages, userId)
    return messages.reverse()
  }

  private async processAttachments(attachments: Omit<MessageAttachment, 'id'>[]): Promise<MessageAttachment[]> {
    return attachments.map(attachment => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...attachment
    }))
  }

  private async verifyConversationAccess(conversationId: string, userId: string): Promise<void> {
    const conversationDoc = await this.db.collection('conversations').doc(conversationId).get()
    
    if (!conversationDoc.exists) {
      throw new Error('Conversation not found')
    }

    const conversation = conversationDoc.data()
    const isParticipant = conversation?.participants?.some((p: any) => p.userId === userId)
    
    if (!isParticipant) {
      throw new Error('Access denied: User is not a participant in this conversation')
    }
  }

  private async markMessagesAsDelivered(messages: Message[], userId: string): Promise<void> {
    const batch = this.db.batch()
    let hasUpdates = false

    for (const message of messages) {
      if (message.senderId !== userId && message.status === 'sent') {
        const messageRef = this.db.collection('messages').doc(message.id)
        batch.update(messageRef, { status: 'delivered' })
        hasUpdates = true
      }
    }

    if (hasUpdates) {
      await batch.commit()
    }
  }

  private async updateConversationActivity(conversationId: string, message: Message): Promise<void> {
    await this.db.collection('conversations').doc(conversationId).update({
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
  }

  private async triggerRealTimeUpdate(conversationId: string, message: Message): Promise<void> {
    await this.rtdb.ref(`conversations/${conversationId}/messages/${message.id}`).set({
      id: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      type: message.type,
      timestamp: message.timestamp.toMillis(),
      status: message.status
    })
  }

  private async sendNotificationsToParticipants(conversationId: string, senderId: string, message: Message): Promise<void> {
    console.log(`Would send notification for message: ${message.content}`)
  }
}