'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  MessageSquare,
  Send,
  Search,
  Users,
  Circle,
  MoreVertical,
  Phone,
  Video,
  Paperclip,
  Smile,
  Reply,
  Forward,
  Trash2,
  Archive,
  Star,
  Clock
} from 'lucide-react'

interface Conversation {
  id: string
  participants: User[]
  lastMessage: Message
  unreadCount: number
  updatedAt: string
  type: 'direct' | 'group'
}

interface Message {
  id: string
  sender: User
  content: string
  timestamp: string
  type: 'text' | 'image' | 'file' | 'system'
  status: 'sent' | 'delivered' | 'read'
  reactions?: Reaction[]
  replyTo?: Message
}

interface User {
  id: string
  name: string
  avatar: string
  online: boolean
  lastSeen?: string
}

interface Reaction {
  emoji: string
  count: number
  users: string[]
}

const mockConversations: Conversation[] = [
  {
    id: '1',
    participants: [
      { id: '1', name: 'Alex Chen', avatar: '/avatars/alex.jpg', online: true },
      { id: '2', name: 'You', avatar: '/avatars/you.jpg', online: true }
    ],
    lastMessage: {
      id: '1',
      sender: { id: '1', name: 'Alex Chen', avatar: '/avatars/alex.jpg', online: true },
      content: 'Thanks for the Ring customization details. When can we schedule a call?',
      timestamp: '2025-01-15T14:30:00Z',
      type: 'text',
      status: 'delivered'
    },
    unreadCount: 2,
    updatedAt: '2025-01-15T14:30:00Z',
    type: 'direct'
  },
  {
    id: '2',
    participants: [
      { id: '3', name: 'Sarah Johnson', avatar: '/avatars/sarah.jpg', online: false, lastSeen: '2025-01-15T12:00:00Z' },
      { id: '4', name: 'Marcus Rodriguez', avatar: '/avatars/marcus.jpg', online: true },
      { id: '2', name: 'You', avatar: '/avatars/you.jpg', online: true }
    ],
    lastMessage: {
      id: '2',
      sender: { id: '3', name: 'Sarah Johnson', avatar: '/avatars/sarah.jpg', online: false },
      content: 'The Web3 integration looks great! Ready for the next phase.',
      timestamp: '2025-01-15T11:45:00Z',
      type: 'text',
      status: 'read'
    },
    unreadCount: 0,
    updatedAt: '2025-01-15T11:45:00Z',
    type: 'group'
  },
  {
    id: '3',
    participants: [
      { id: '5', name: 'TechCorp Solutions', avatar: '/companies/techcorp.jpg', online: true },
      { id: '2', name: 'You', avatar: '/avatars/you.jpg', online: true }
    ],
    lastMessage: {
      id: '3',
      sender: { id: '5', name: 'TechCorp Solutions', avatar: '/companies/techcorp.jpg', online: true },
      content: 'Project proposal attached. Please review and let us know your thoughts.',
      timestamp: '2025-01-14T16:20:00Z',
      type: 'text',
      status: 'read'
    },
    unreadCount: 1,
    updatedAt: '2025-01-14T16:20:00Z',
    type: 'direct'
  }
]

const mockMessages: Message[] = [
  {
    id: '1',
    sender: { id: '1', name: 'Alex Chen', avatar: '/avatars/alex.jpg', online: true },
    content: 'Hi! I saw your Ring customization services. I\'m looking to implement a white-label solution for my client.',
    timestamp: '2025-01-15T14:00:00Z',
    type: 'text',
    status: 'read'
  },
  {
    id: '2',
    sender: { id: '2', name: 'You', avatar: '/avatars/you.jpg', online: true },
    content: 'Hi Alex! I\'d be happy to help. Could you tell me more about your requirements?',
    timestamp: '2025-01-15T14:15:00Z',
    type: 'text',
    status: 'read'
  },
  {
    id: '3',
    sender: { id: '1', name: 'Alex Chen', avatar: '/avatars/alex.jpg', online: true },
    content: 'Thanks for the Ring customization details. When can we schedule a call?',
    timestamp: '2025-01-15T14:30:00Z',
    type: 'text',
    status: 'delivered'
  }
]

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(mockConversations[0])
  const [messages, setMessages] = useState<Message[]>(mockMessages)
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const filteredConversations = conversations.filter(conversation => {
    const searchableText = conversation.participants
      .map(p => p.name)
      .join(' ')
      .toLowerCase()
    return searchableText.includes(searchQuery.toLowerCase()) ||
           conversation.lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleSendMessage = () => {
    if (!newMessage.trim()) return

    const message: Message = {
      id: Date.now().toString(),
      sender: { id: '2', name: 'You', avatar: '/avatars/you.jpg', online: true },
      content: newMessage,
      timestamp: new Date().toISOString(),
      type: 'text',
      status: 'sent'
    }

    setMessages([...messages, message])
    setNewMessage('')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'text-gray-400'
      case 'delivered': return 'text-blue-500'
      case 'read': return 'text-green-500'
      default: return 'text-gray-400'
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar - Conversations List */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Messages
            </h1>
            <Button size="sm" variant="outline">
              <Users className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setSelectedConversation(conversation)}
                className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 mb-1 ${
                  selectedConversation?.id === conversation.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    {conversation.type === 'group' ? (
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <Avatar
                        src={conversation.participants[0].avatar}
                        alt={conversation.participants[0].name}
                        fallback={conversation.participants[0].name.split(' ').map(n => n[0]).join('')}
                        className="w-10 h-10"
                      />
                    )}
                    {conversation.participants.some(p => p.online) && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm truncate">
                        {conversation.type === 'group'
                          ? conversation.participants.slice(0, 2).map(p => p.name.split(' ')[0]).join(', ') +
                            (conversation.participants.length > 2 ? ` +${conversation.participants.length - 2}` : '')
                          : conversation.participants[0].name
                        }
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTime(conversation.updatedAt)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1">
                      {conversation.lastMessage.sender.id === '2' ? 'You: ' : ''}
                      {conversation.lastMessage.content}
                    </p>

                    {conversation.unreadCount > 0 && (
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="destructive" className="text-xs">
                          {conversation.unreadCount}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {selectedConversation.type === 'group' ? (
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <Avatar
                      src={selectedConversation.participants[0].avatar}
                      alt={selectedConversation.participants[0].name}
                      fallback={selectedConversation.participants[0].name.split(' ').map(n => n[0]).join('')}
                      className="w-10 h-10"
                    />
                  )}

                  <div>
                    <h2 className="font-semibold">
                      {selectedConversation.type === 'group'
                        ? selectedConversation.participants.slice(0, 2).map(p => p.name.split(' ')[0]).join(', ') +
                          (selectedConversation.participants.length > 2 ? ` +${selectedConversation.participants.length - 2}` : '')
                        : selectedConversation.participants[0].name
                      }
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedConversation.participants.filter(p => p.online).length} online
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Video className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender.id === '2' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex space-x-2 max-w-xs lg:max-w-md ${message.sender.id === '2' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <Avatar
                        src={message.sender.avatar}
                        alt={message.sender.name}
                        fallback={message.sender.name.split(' ').map(n => n[0]).join('')}
                        className="w-8 h-8"
                      />

                      <div className={`rounded-lg p-3 ${
                        message.sender.id === '2'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <div className={`flex items-center justify-end mt-1 text-xs ${
                          message.sender.id === '2' ? 'text-blue-200' : 'text-gray-500'
                        }`}>
                          <span>{formatTime(message.timestamp)}</span>
                          {message.sender.id === '2' && (
                            <Circle className={`w-3 h-3 ml-1 ${getStatusColor(message.status)}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    className="min-h-[40px] max-h-32 resize-none"
                    rows={1}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Smile className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Choose a conversation from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
