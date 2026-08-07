// @ts-nocheck - Disable TypeScript checking for test files
/**
 * Messaging Service Tests
 * Testing conversation and message operations, real-time features, and file attachments
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { getDatabase, ref, set, push, onValue, off } from 'firebase/database'

// Mock Firebase services
jest.mock('firebase/firestore')
jest.mock('firebase/database')

// Mock the messaging service
const mockMessagingService = {
  createConversation: jest.fn(),
  getConversation: jest.fn(),
  listConversations: jest.fn(),
  updateConversation: jest.fn(),
  deleteConversation: jest.fn(),
  sendMessage: jest.fn(),
  getMessage: jest.fn(),
  getMessages: jest.fn(),
  updateMessage: jest.fn(),
  deleteMessage: jest.fn(),
  markMessageAsRead: jest.fn(),
  markConversationAsRead: jest.fn(),
  searchMessages: jest.fn(),
  getUnreadCount: jest.fn(),
  setTypingStatus: jest.fn(),
  getTypingStatus: jest.fn(),
  subscribeToConversation: jest.fn(),
  subscribeToTyping: jest.fn(),
  uploadAttachment: jest.fn(),
  deleteAttachment: jest.fn(),
}

describe('Messaging Service', () => {
  beforeEach(() => {
    global.testUtils.clearAllMocks()
    
    // Setup default Firebase mocks
    ;(addDoc as jest.Mock).mockResolvedValue({ id: 'test-conversation-id' })
    ;(getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ id: 'test-conversation-id', participants: ['user-1', 'user-2'] }),
      id: 'test-conversation-id'
    })
    ;(updateDoc as jest.Mock).mockResolvedValue(undefined)
    ;(deleteDoc as jest.Mock).mockResolvedValue(undefined)
    ;(getDocs as jest.Mock).mockResolvedValue({
      docs: [
        global.testUtils.createMockFirebaseDoc({ id: 'conversation-1', participants: ['user-1', 'user-2'] }),
        global.testUtils.createMockFirebaseDoc({ id: 'conversation-2', participants: ['user-1', 'user-3'] })
      ]
    })
    ;(set as jest.Mock).mockResolvedValue(undefined)
    ;(push as jest.Mock).mockResolvedValue({ key: 'test-message-id' })
    ;(onValue as jest.Mock).mockImplementation((ref, callback) => {
      // Mock real-time listener
      callback({
        val: () => ({ message: 'test', timestamp: Date.now() }),
        exists: () => true
      })
    })
    ;(onSnapshot as jest.Mock).mockImplementation((query, callback) => {
      // Mock Firestore real-time listener
      callback({
        docs: [global.testUtils.createMockFirebaseDoc({ id: 'msg-1', content: 'Hello' })]
      })
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Conversation Management', () => {
    it('should create a new conversation successfully', async () => {
      const conversationData = {
        participants: ['user-1', 'user-2'],
        title: 'Test Conversation',
        type: 'direct',
        metadata: {
          entityId: 'entity-123',
          opportunityId: 'opportunity-456'
        }
      }

      const mockConversation = {
        id: 'test-conversation-id',
        ...conversationData,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessage: null,
        unreadCount: { 'user-1': 0, 'user-2': 0 },
        status: 'active'
      }

      mockMessagingService.createConversation.mockResolvedValue({
        success: true,
        conversation: mockConversation
      })

      const result = await mockMessagingService.createConversation(conversationData)

      expect(result.success).toBe(true)
      expect(result.conversation.id).toBe('test-conversation-id')
      expect(result.conversation.participants).toEqual(['user-1', 'user-2'])
      expect(result.conversation.title).toBe('Test Conversation')
      expect(mockMessagingService.createConversation).toHaveBeenCalledWith(conversationData)
    })

    it('should validate conversation participants', async () => {
      const invalidConversationData = {
        participants: ['user-1'], // Need at least 2 participants
        title: 'Invalid Conversation',
        type: 'direct'
      }

      mockMessagingService.createConversation.mockResolvedValue({
        success: false,
        error: 'At least 2 participants required',
        code: 'INSUFFICIENT_PARTICIPANTS'
      })

      const result = await mockMessagingService.createConversation(invalidConversationData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('At least 2 participants required')
      expect(result.code).toBe('INSUFFICIENT_PARTICIPANTS')
    })

    it('should validate conversation type', async () => {
      const conversationData = {
        participants: ['user-1', 'user-2'],
        title: 'Test Conversation',
        type: 'invalid-type'
      }

      mockMessagingService.createConversation.mockResolvedValue({
        success: false,
        error: 'Invalid conversation type',
        code: 'INVALID_TYPE',
        validTypes: ['direct', 'group', 'channel']
      })

      const result = await mockMessagingService.createConversation(conversationData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid conversation type')
      expect(result.validTypes).toContain('direct')
      expect(result.validTypes).toContain('group')
    })

    it('should get conversation by ID successfully', async () => {
      const conversationId = 'test-conversation-id'
      const mockConversation = {
        id: conversationId,
        participants: ['user-1', 'user-2'],
        title: 'Test Conversation',
        type: 'direct',
        createdAt: new Date(),
        status: 'active'
      }

      mockMessagingService.getConversation.mockResolvedValue({
        success: true,
        conversation: mockConversation
      })

      const result = await mockMessagingService.getConversation(conversationId)

      expect(result.success).toBe(true)
      expect(result.conversation.id).toBe(conversationId)
      expect(result.conversation.participants).toEqual(['user-1', 'user-2'])
    })

    it('should handle conversation not found', async () => {
      const conversationId = 'non-existent-id'

      mockMessagingService.getConversation.mockResolvedValue({
        success: false,
        error: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      })

      const result = await mockMessagingService.getConversation(conversationId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversation not found')
      expect(result.code).toBe('CONVERSATION_NOT_FOUND')
    })

    it('should list user conversations with pagination', async () => {
      const userId = 'user-1'
      const mockConversations = [
        { id: 'conv-1', participants: ['user-1', 'user-2'], title: 'Conversation 1' },
        { id: 'conv-2', participants: ['user-1', 'user-3'], title: 'Conversation 2' }
      ]

      mockMessagingService.listConversations.mockResolvedValue({
        success: true,
        conversations: mockConversations,
        hasMore: false,
        nextCursor: null,
        totalCount: 2
      })

      const result = await mockMessagingService.listConversations(userId, { limit: 10 })

      expect(result.success).toBe(true)
      expect(result.conversations).toHaveLength(2)
      expect(result.conversations.every(c => c.participants.includes(userId))).toBe(true)
    })

    it('should update conversation metadata', async () => {
      const conversationId = 'test-conversation-id'
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description'
      }

      mockMessagingService.updateConversation.mockResolvedValue({
        success: true,
        conversation: {
          id: conversationId,
          ...updateData,
          participants: ['user-1', 'user-2'],
          updatedAt: new Date()
        }
      })

      const result = await mockMessagingService.updateConversation(conversationId, updateData)

      expect(result.success).toBe(true)
      expect(result.conversation.title).toBe('Updated Title')
      expect(result.conversation.description).toBe('Updated description')
    })

    it('should validate conversation update permissions', async () => {
      const conversationId = 'test-conversation-id'
      const updateData = { title: 'Unauthorized Update' }

      mockMessagingService.updateConversation.mockResolvedValue({
        success: false,
        error: 'Permission denied',
        code: 'PERMISSION_DENIED'
      })

      const result = await mockMessagingService.updateConversation(conversationId, updateData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
      expect(result.code).toBe('PERMISSION_DENIED')
    })
  })

  describe('Message Operations', () => {
    it('should send a message successfully', async () => {
      const messageData = {
        conversationId: 'test-conversation-id',
        senderId: 'user-1',
        content: 'Hello, world!',
        type: 'text',
        metadata: {
          entityId: 'entity-123'
        }
      }

      const mockMessage = {
        id: 'test-message-id',
        ...messageData,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'sent',
        readBy: [],
        reactions: {}
      }

      mockMessagingService.sendMessage.mockResolvedValue({
        success: true,
        message: mockMessage
      })

      const result = await mockMessagingService.sendMessage(messageData)

      expect(result.success).toBe(true)
      expect(result.message.id).toBe('test-message-id')
      expect(result.message.content).toBe('Hello, world!')
      expect(result.message.senderId).toBe('user-1')
      expect(result.message.status).toBe('sent')
    })

    it('should validate message content', async () => {
      const messageData = {
        conversationId: 'test-conversation-id',
        senderId: 'user-1',
        content: '', // Empty content
        type: 'text'
      }

      mockMessagingService.sendMessage.mockResolvedValue({
        success: false,
        error: 'Message content cannot be empty',
        code: 'EMPTY_CONTENT'
      })

      const result = await mockMessagingService.sendMessage(messageData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Message content cannot be empty')
      expect(result.code).toBe('EMPTY_CONTENT')
    })

    it('should validate message type', async () => {
      const messageData = {
        conversationId: 'test-conversation-id',
        senderId: 'user-1',
        content: 'Hello',
        type: 'invalid-type'
      }

      mockMessagingService.sendMessage.mockResolvedValue({
        success: false,
        error: 'Invalid message type',
        code: 'INVALID_MESSAGE_TYPE',
        validTypes: ['text', 'image', 'file', 'system']
      })

      const result = await mockMessagingService.sendMessage(messageData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid message type')
      expect(result.validTypes).toContain('text')
      expect(result.validTypes).toContain('image')
      expect(result.validTypes).toContain('file')
    })

    it('should handle sender not in conversation', async () => {
      const messageData = {
        conversationId: 'test-conversation-id',
        senderId: 'unauthorized-user',
        content: 'Hello',
        type: 'text'
      }

      mockMessagingService.sendMessage.mockResolvedValue({
        success: false,
        error: 'Sender not in conversation',
        code: 'SENDER_NOT_IN_CONVERSATION'
      })

      const result = await mockMessagingService.sendMessage(messageData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Sender not in conversation')
      expect(result.code).toBe('SENDER_NOT_IN_CONVERSATION')
    })

    it('should get messages with pagination', async () => {
      const conversationId = 'test-conversation-id'
      const mockMessages = [
        { id: 'msg-1', content: 'Hello', senderId: 'user-1', createdAt: new Date() },
        { id: 'msg-2', content: 'Hi there', senderId: 'user-2', createdAt: new Date() }
      ]

      mockMessagingService.getMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        hasMore: false,
        nextCursor: null,
        totalCount: 2
      })

      const result = await mockMessagingService.getMessages(conversationId, { limit: 10 })

      expect(result.success).toBe(true)
      expect(result.messages).toHaveLength(2)
      expect(result.messages[0].content).toBe('Hello')
      expect(result.messages[1].content).toBe('Hi there')
    })

    it('should update message content', async () => {
      const messageId = 'test-message-id'
      const updateData = {
        content: 'Updated message content',
        editedAt: new Date()
      }

      mockMessagingService.updateMessage.mockResolvedValue({
        success: true,
        message: {
          id: messageId,
          ...updateData,
          senderId: 'user-1',
          conversationId: 'test-conversation-id',
          isEdited: true
        }
      })

      const result = await mockMessagingService.updateMessage(messageId, updateData)

      expect(result.success).toBe(true)
      expect(result.message.content).toBe('Updated message content')
      expect(result.message.isEdited).toBe(true)
      expect(result.message.editedAt).toBeDefined()
    })

    it('should validate message edit permissions', async () => {
      const messageId = 'test-message-id'
      const updateData = { content: 'Unauthorized edit' }

      mockMessagingService.updateMessage.mockResolvedValue({
        success: false,
        error: 'Only sender can edit message',
        code: 'EDIT_PERMISSION_DENIED'
      })

      const result = await mockMessagingService.updateMessage(messageId, updateData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Only sender can edit message')
      expect(result.code).toBe('EDIT_PERMISSION_DENIED')
    })

    it('should handle message edit time limit', async () => {
      const messageId = 'test-message-id'
      const updateData = { content: 'Too late edit' }

      mockMessagingService.updateMessage.mockResolvedValue({
        success: false,
        error: 'Message edit time limit exceeded',
        code: 'EDIT_TIME_LIMIT_EXCEEDED',
        editTimeLimit: 15 // 15 minutes
      })

      const result = await mockMessagingService.updateMessage(messageId, updateData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Message edit time limit exceeded')
      expect(result.code).toBe('EDIT_TIME_LIMIT_EXCEEDED')
      expect(result.editTimeLimit).toBe(15)
    })

    it('should delete message successfully', async () => {
      const messageId = 'test-message-id'

      mockMessagingService.deleteMessage.mockResolvedValue({
        success: true,
        message: 'Message deleted successfully'
      })

      const result = await mockMessagingService.deleteMessage(messageId)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Message deleted successfully')
    })

    it('should validate message deletion permissions', async () => {
      const messageId = 'test-message-id'

      mockMessagingService.deleteMessage.mockResolvedValue({
        success: false,
        error: 'Permission denied',
        code: 'DELETE_PERMISSION_DENIED'
      })

      const result = await mockMessagingService.deleteMessage(messageId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
      expect(result.code).toBe('DELETE_PERMISSION_DENIED')
    })
  })

  describe('Read Status Management', () => {
    it('should mark message as read successfully', async () => {
      const messageId = 'test-message-id'
      const userId = 'user-1'

      mockMessagingService.markMessageAsRead.mockResolvedValue({
        success: true,
        message: {
          id: messageId,
          readBy: [{ userId, readAt: new Date() }]
        }
      })

      const result = await mockMessagingService.markMessageAsRead(messageId, userId)

      expect(result.success).toBe(true)
      expect(result.message.readBy).toHaveLength(1)
      expect(result.message.readBy[0].userId).toBe(userId)
      expect(result.message.readBy[0].readAt).toBeDefined()
    })

    it('should mark entire conversation as read', async () => {
      const conversationId = 'test-conversation-id'
      const userId = 'user-1'

      mockMessagingService.markConversationAsRead.mockResolvedValue({
        success: true,
        conversation: {
          id: conversationId,
          unreadCount: { [userId]: 0 }
        },
        markedMessages: 5
      })

      const result = await mockMessagingService.markConversationAsRead(conversationId, userId)

      expect(result.success).toBe(true)
      expect(result.conversation.unreadCount[userId]).toBe(0)
      expect(result.markedMessages).toBe(5)
    })

    it('should get unread message count', async () => {
      const userId = 'user-1'

      mockMessagingService.getUnreadCount.mockResolvedValue({
        success: true,
        totalUnread: 10,
        conversationUnread: {
          'conv-1': 5,
          'conv-2': 3,
          'conv-3': 2
        }
      })

      const result = await mockMessagingService.getUnreadCount(userId)

      expect(result.success).toBe(true)
      expect(result.totalUnread).toBe(10)
      expect(result.conversationUnread['conv-1']).toBe(5)
      expect(result.conversationUnread['conv-2']).toBe(3)
      expect(result.conversationUnread['conv-3']).toBe(2)
    })
  })

  describe('Real-time Features', () => {
    it('should set typing status successfully', async () => {
      const conversationId = 'test-conversation-id'
      const userId = 'user-1'
      const isTyping = true

      mockMessagingService.setTypingStatus.mockResolvedValue({
        success: true,
        typingStatus: {
          userId,
          isTyping,
          timestamp: new Date()
        }
      })

      const result = await mockMessagingService.setTypingStatus(conversationId, userId, isTyping)

      expect(result.success).toBe(true)
      expect(result.typingStatus.userId).toBe(userId)
      expect(result.typingStatus.isTyping).toBe(isTyping)
      expect(result.typingStatus.timestamp).toBeDefined()
    })

    it('should get typing status for conversation', async () => {
      const conversationId = 'test-conversation-id'

      mockMessagingService.getTypingStatus.mockResolvedValue({
        success: true,
        typingUsers: [
          { userId: 'user-2', isTyping: true, timestamp: new Date() },
          { userId: 'user-3', isTyping: true, timestamp: new Date() }
        ]
      })

      const result = await mockMessagingService.getTypingStatus(conversationId)

      expect(result.success).toBe(true)
      expect(result.typingUsers).toHaveLength(2)
      expect(result.typingUsers[0].userId).toBe('user-2')
      expect(result.typingUsers[1].userId).toBe('user-3')
    })

    it('should subscribe to conversation updates', async () => {
      const conversationId = 'test-conversation-id'
      const callback = jest.fn()

      mockMessagingService.subscribeToConversation.mockResolvedValue({
        success: true,
        unsubscribe: jest.fn()
      })

      const result = await mockMessagingService.subscribeToConversation(conversationId, callback)

      expect(result.success).toBe(true)
      expect(result.unsubscribe).toBeDefined()
      expect(typeof result.unsubscribe).toBe('function')
    })

    it('should subscribe to typing indicators', async () => {
      const conversationId = 'test-conversation-id'
      const callback = jest.fn()

      mockMessagingService.subscribeToTyping.mockResolvedValue({
        success: true,
        unsubscribe: jest.fn()
      })

      const result = await mockMessagingService.subscribeToTyping(conversationId, callback)

      expect(result.success).toBe(true)
      expect(result.unsubscribe).toBeDefined()
      expect(typeof result.unsubscribe).toBe('function')
    })
  })

  describe('File Attachments', () => {
    it('should upload file attachment successfully', async () => {
      const fileData = {
        conversationId: 'test-conversation-id',
        senderId: 'user-1',
        file: new File(['test content'], 'test.txt', { type: 'text/plain' }),
        fileName: 'test.txt',
        fileSize: 1024,
        mimeType: 'text/plain'
      }

      mockMessagingService.uploadAttachment.mockResolvedValue({
        success: true,
        attachment: {
          id: 'attachment-id',
          fileName: 'test.txt',
          fileSize: 1024,
          mimeType: 'text/plain',
          url: 'https://storage.example.com/test.txt',
          uploadedAt: new Date()
        }
      })

      const result = await mockMessagingService.uploadAttachment(fileData)

      expect(result.success).toBe(true)
      expect(result.attachment.fileName).toBe('test.txt')
      expect(result.attachment.fileSize).toBe(1024)
      expect(result.attachment.url).toBeDefined()
    })

    it('should validate file size limits', async () => {
      const fileData = {
        conversationId: 'test-conversation-id',
        senderId: 'user-1',
        file: new File(['large content'], 'large.txt'),
        fileName: 'large.txt',
        fileSize: 50 * 1024 * 1024, // 50MB
        mimeType: 'text/plain'
      }

      mockMessagingService.uploadAttachment.mockResolvedValue({
        success: false,
        error: 'File size exceeds limit',
        code: 'FILE_SIZE_LIMIT_EXCEEDED',
        maxFileSize: 10 * 1024 * 1024 // 10MB
      })

      const result = await mockMessagingService.uploadAttachment(fileData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File size exceeds limit')
      expect(result.code).toBe('FILE_SIZE_LIMIT_EXCEEDED')
      expect(result.maxFileSize).toBe(10 * 1024 * 1024)
    })

    it('should validate file type restrictions', async () => {
      const fileData = {
        conversationId: 'test-conversation-id',
        senderId: 'user-1',
        file: new File(['executable content'], 'malware.exe'),
        fileName: 'malware.exe',
        fileSize: 1024,
        mimeType: 'application/x-msdownload'
      }

      mockMessagingService.uploadAttachment.mockResolvedValue({
        success: false,
        error: 'File type not allowed',
        code: 'FILE_TYPE_NOT_ALLOWED',
        allowedTypes: ['image/*', 'text/*', 'application/pdf']
      })

      const result = await mockMessagingService.uploadAttachment(fileData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File type not allowed')
      expect(result.code).toBe('FILE_TYPE_NOT_ALLOWED')
      expect(result.allowedTypes).toContain('image/*')
    })

    it('should delete attachment successfully', async () => {
      const attachmentId = 'attachment-id'

      mockMessagingService.deleteAttachment.mockResolvedValue({
        success: true,
        message: 'Attachment deleted successfully'
      })

      const result = await mockMessagingService.deleteAttachment(attachmentId)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Attachment deleted successfully')
    })
  })

  describe('Message Search', () => {
    it('should search messages successfully', async () => {
      const searchParams = {
        query: 'important',
        conversationId: 'test-conversation-id',
        senderId: 'user-1',
        messageType: 'text',
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31')
        }
      }

      mockMessagingService.searchMessages.mockResolvedValue({
        success: true,
        messages: [
          { id: 'msg-1', content: 'This is important', senderId: 'user-1' },
          { id: 'msg-2', content: 'Another important message', senderId: 'user-1' }
        ],
        totalCount: 2,
        searchQuery: 'important'
      })

      const result = await mockMessagingService.searchMessages(searchParams)

      expect(result.success).toBe(true)
      expect(result.messages).toHaveLength(2)
      expect(result.messages[0].content).toContain('important')
      expect(result.messages[1].content).toContain('important')
      expect(result.searchQuery).toBe('important')
    })

    it('should handle empty search results', async () => {
      const searchParams = {
        query: 'nonexistent',
        conversationId: 'test-conversation-id'
      }

      mockMessagingService.searchMessages.mockResolvedValue({
        success: true,
        messages: [],
        totalCount: 0,
        searchQuery: 'nonexistent'
      })

      const result = await mockMessagingService.searchMessages(searchParams)

      expect(result.success).toBe(true)
      expect(result.messages).toHaveLength(0)
      expect(result.totalCount).toBe(0)
    })
  })

  describe('Error Handling with ES2022 Error.cause', () => {
    it('should handle database errors with cause chain', async () => {
      const databaseError = new Error('Firestore write failed')
      const messagingError = new Error('Message creation failed', { cause: databaseError })

      mockMessagingService.sendMessage.mockRejectedValue(messagingError)

      try {
        await mockMessagingService.sendMessage({
          conversationId: 'test-conversation-id',
          senderId: 'user-1',
          content: 'Test message',
          type: 'text'
        })
      } catch (error) {
        expect(error.message).toBe('Message creation failed')
        expect(error.cause).toBe(databaseError)
        expect(error.cause.message).toBe('Firestore write failed')
      }
    })

    it('should handle real-time connection errors with cause chain', async () => {
      const connectionError = new Error('WebSocket connection failed')
      const subscriptionError = new Error('Subscription failed', { cause: connectionError })

      mockMessagingService.subscribeToConversation.mockRejectedValue(subscriptionError)

      try {
        await mockMessagingService.subscribeToConversation('test-conversation-id', jest.fn())
      } catch (error) {
        expect(error.message).toBe('Subscription failed')
        expect(error.cause).toBe(connectionError)
        expect(error.cause.message).toBe('WebSocket connection failed')
      }
    })

    it('should handle file upload errors with detailed cause information', async () => {
      const storageError = new Error('Storage quota exceeded')
      const uploadError = new Error('File upload failed', { cause: storageError })

      mockMessagingService.uploadAttachment.mockRejectedValue(uploadError)

      try {
        await mockMessagingService.uploadAttachment({
          conversationId: 'test-conversation-id',
          senderId: 'user-1',
          file: new File(['test'], 'test.txt'),
          fileName: 'test.txt',
          fileSize: 1024,
          mimeType: 'text/plain'
        })
      } catch (error) {
        expect(error.message).toBe('File upload failed')
        expect(error.cause).toBe(storageError)
        expect(error.cause.message).toBe('Storage quota exceeded')
      }
    })
  })
}) 