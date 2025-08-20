import { getAdminRtdb } from '@/lib/firebase-admin.server'
import { TypingIndicator } from '@/features/chat/types'

export class TypingService {
  private rtdb = getAdminRtdb()
  private readonly TYPING_TIMEOUT = 5000 // 5 seconds

  async updateTypingStatus(conversationId: string, userId: string, userName: string, isTyping: boolean): Promise<void> {
    const typingRef = this.rtdb.ref(`typing/${conversationId}/${userId}`)
    
    if (isTyping) {
      // Set typing status with auto-cleanup timeout
      const typingData: TypingIndicator = {
        conversationId,
        userId,
        userName,
        timestamp: Date.now() as any // Convert to number for real-time database
      }
      
      await typingRef.set(typingData)
      
      // Set auto-cleanup timeout (will be overridden if user continues typing)
      await typingRef.onDisconnect().remove()
      
      // Set server-side cleanup after timeout
      setTimeout(async () => {
        try {
          const snapshot = await typingRef.once('value')
          const data = snapshot.val()
          
          // Only remove if timestamp is old (user stopped typing)
          if (data && Date.now() - data.timestamp > this.TYPING_TIMEOUT) {
            await typingRef.remove()
          }
        } catch (error) {
          console.error('Error cleaning up typing indicator:', error)
        }
      }, this.TYPING_TIMEOUT)
      
    } else {
      // Remove typing status
      await typingRef.remove()
    }
  }

  async getTypingUsers(conversationId: string): Promise<TypingIndicator[]> {
    const typingRef = this.rtdb.ref(`typing/${conversationId}`)
    const snapshot = await typingRef.once('value')
    const typingData = snapshot.val()
    
    if (!typingData) {
      return []
    }
    
    const now = Date.now()
    const activeTypingUsers: TypingIndicator[] = []
    
    // Filter out expired indicators and convert to proper format
    for (const [userId, data] of Object.entries(typingData as Record<string, any>)) {
      const typingInfo = data as TypingIndicator
      
      // Check if typing indicator is still valid (not expired)
      if (now - (typingInfo.timestamp as any) <= this.TYPING_TIMEOUT) {
        activeTypingUsers.push(typingInfo)
      } else {
        // Clean up expired indicator
        await this.rtdb.ref(`typing/${conversationId}/${userId}`).remove()
      }
    }
    
    return activeTypingUsers
  }

  async cleanupTypingIndicators(conversationId: string): Promise<void> {
    const typingRef = this.rtdb.ref(`typing/${conversationId}`)
    const snapshot = await typingRef.once('value')
    const typingData = snapshot.val()
    
    if (!typingData) {
      return
    }
    
    const now = Date.now()
    const batch: Promise<void>[] = []
    
    // Remove all expired typing indicators
    for (const [userId, data] of Object.entries(typingData as Record<string, any>)) {
      const typingInfo = data as TypingIndicator
      
      if (now - (typingInfo.timestamp as any) > this.TYPING_TIMEOUT) {
        batch.push(this.rtdb.ref(`typing/${conversationId}/${userId}`).remove())
      }
    }
    
    await Promise.all(batch)
  }

  async stopTyping(conversationId: string, userId: string): Promise<void> {
    await this.rtdb.ref(`typing/${conversationId}/${userId}`).remove()
  }

  // Helper method to set up real-time listeners for typing indicators
  setupTypingListener(conversationId: string, callback: (typingUsers: TypingIndicator[]) => void): () => void {
    const typingRef = this.rtdb.ref(`typing/${conversationId}`)
    
    const listener = typingRef.on('value', (snapshot) => {
      const typingData = snapshot.val()
      const typingUsers: TypingIndicator[] = []
      
      if (typingData) {
        const now = Date.now()
        
        for (const [userId, data] of Object.entries(typingData as Record<string, any>)) {
          const typingInfo = data as TypingIndicator
          
          // Only include non-expired typing indicators
          if (now - (typingInfo.timestamp as any) <= this.TYPING_TIMEOUT) {
            typingUsers.push(typingInfo)
          }
        }
      }
      
      callback(typingUsers)
    })
    
    // Return cleanup function
    return () => {
      typingRef.off('value', listener)
    }
  }
} 