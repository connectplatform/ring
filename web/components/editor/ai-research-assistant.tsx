'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Send,
  RefreshCw,
  BookOpen,
  Quote,
  FileEdit,
  X,
  MessageCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useFormatter, useTranslations } from 'next-intl'
import { usePickAiResearchResponse } from '@/lib/editor-ai-helpers'

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  quickReplies?: string[]
}

interface PublicationMetadata {
  title: string
  authors: string[]
  institution: string
  date: string
  keywords: string[]
}

type OnboardingStep = 
  | 'welcome' 
  | 'ask_title' 
  | 'ask_authors' 
  | 'ask_institution' 
  | 'completed'
  | 'skipped'

export interface AIResearchAssistantProps {
  metadata: PublicationMetadata
  onMetadataChange: (metadata: PublicationMetadata) => void
  onContentGenerated?: (content: string) => void
  onNewPublication?: () => void
  isFloating?: boolean
  onClose?: () => void
  className?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  ONBOARDING_COMPLETED: 'zemna_onboarding_completed',
  CHAT_HISTORY: 'zemna_chat_history'
}

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(key)
      if (stored) return JSON.parse(stored) as T
    }
  } catch (e) {
    console.warn('Failed to load from localStorage:', e)
  }
  return defaultValue
}

const saveToStorage = (key: string, data: unknown) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data))
    }
  } catch (e) {
    console.warn('Failed to save to localStorage:', e)
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AIResearchAssistant - Conversational AI sidebar for scientific writing
 * 
 * Features:
 * - Conversational onboarding to collect metadata
 * - Context-aware help for scientific writing
 * - Quick action buttons
 * - Can be used as sidebar or floating panel
 */
export function AIResearchAssistant({
  metadata,
  onMetadataChange,
  onContentGenerated,
  onNewPublication,
  isFloating = false,
  onClose,
  className = ''
}: AIResearchAssistantProps) {
  const t = useTranslations('editor.aiAssistant')
  const tOnboard = useTranslations('editor.aiAssistant.onboarding')
  const tTpl = useTranslations('editor.templates')
  const format = useFormatter()
  const pickAiResearchResponse = usePickAiResearchResponse()
  
  // State
  const [isHydrated, setIsHydrated] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('welcome')
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [localMetadata, setLocalMetadata] = useState(metadata)
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Hydrate from localStorage
  useEffect(() => {
    const savedOnboardingComplete = loadFromStorage<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETED, false)
    if (savedOnboardingComplete) {
      setIsOnboardingComplete(true)
      setOnboardingStep('completed')
    }
    setIsHydrated(true)
  }, [])

  // Sync metadata prop
  useEffect(() => {
    setLocalMetadata(metadata)
  }, [metadata])

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Add AI message helper
  const addAiMessage = useCallback((content: string, quickReplies?: string[]) => {
    setIsAiTyping(true)
    
    setTimeout(() => {
      const message: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content,
        timestamp: new Date(),
        quickReplies
      }
      setChatMessages(prev => [...prev, message])
      setIsAiTyping(false)
    }, 800)
  }, [])

  // Initialize onboarding
  useEffect(() => {
    if (!isHydrated || chatMessages.length > 0) return
    
    const hasExistingSession = loadFromStorage<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETED, false)
    
    if (hasExistingSession) {
      addAiMessage(tOnboard('welcomeBack', { title: metadata.title }))
      setOnboardingStep('completed')
      setIsOnboardingComplete(true)
    } else {
      setTimeout(() => {
        addAiMessage(tOnboard('welcome'))
      }, 500)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: initialization effect runs once on hydration
  }, [isHydrated])

  // Generate AI response
  const generateAiResponse = useCallback(
    (input: string): string => pickAiResearchResponse(input.toLowerCase()),
    [pickAiResearchResponse],
  )

  // Process onboarding message
  const processOnboardingMessage = useCallback((userInput: string) => {
    const trimmedInput = userInput.trim()
    
    switch (onboardingStep) {
      case 'welcome':
      case 'ask_title':
        const newMetaTitle = { ...localMetadata, title: trimmedInput }
        setLocalMetadata(newMetaTitle)
        onMetadataChange(newMetaTitle)
        setOnboardingStep('ask_authors')
        addAiMessage(tOnboard('askAuthors'))
        break
        
      case 'ask_authors':
        const authors = trimmedInput.split(',').map(a => a.trim()).filter(Boolean)
        const newMetaAuthors = { ...localMetadata, authors }
        setLocalMetadata(newMetaAuthors)
        onMetadataChange(newMetaAuthors)
        setOnboardingStep('ask_institution')
        addAiMessage(tOnboard('askInstitution'))
        break
        
      case 'ask_institution':
        const newMetaInst = { ...localMetadata, institution: trimmedInput }
        setLocalMetadata(newMetaInst)
        onMetadataChange(newMetaInst)
        setOnboardingStep('completed')
        setIsOnboardingComplete(true)
        saveToStorage(STORAGE_KEYS.ONBOARDING_COMPLETED, true)
        
        const authorsLabel =
          newMetaInst.authors.join(', ') || trimmedInput.split(',')[0] || ''
        addAiMessage(
          tOnboard('completed', {
            title: localMetadata.title,
            authors: authorsLabel,
            institution: trimmedInput,
          }),
          tOnboard.raw('suggestions') as string[],
        )

        if (onContentGenerated) {
          onContentGenerated(
            tTpl('publication', {
              title: newMetaInst.title,
              authors: authorsLabel,
              institution: newMetaInst.institution,
              date: format.dateTime(new Date(), { dateStyle: 'medium' }),
            }),
          )
        }
        break
        
      case 'completed':
        setIsAiTyping(true)
        setTimeout(() => {
          addAiMessage(generateAiResponse(trimmedInput))
        }, 1000)
        break
    }
  }, [
    onboardingStep,
    localMetadata,
    tOnboard,
    tTpl,
    format,
    addAiMessage,
    onMetadataChange,
    onContentGenerated,
    generateAiResponse,
  ])

  // Send message
  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim()) return
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    }
    
    setChatMessages(prev => [...prev, userMessage])
    const input = chatInput
    setChatInput('')
    processOnboardingMessage(input)
  }, [chatInput, processOnboardingMessage])

  // Quick reply
  const handleQuickReply = useCallback((reply: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: reply,
      timestamp: new Date()
    }
    setChatMessages(prev => [...prev, userMessage])
    
    if (isOnboardingComplete) {
      setIsAiTyping(true)
      setTimeout(() => {
        addAiMessage(generateAiResponse(reply))
      }, 1000)
    }
  }, [isOnboardingComplete, addAiMessage, generateAiResponse])

  return (
    <div className={`flex flex-col h-full bg-muted/20 ${className}`}>
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-[#1e3a5f]/10 to-[#4a9b8c]/10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#4a9b8c] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                {t('title')}
              </h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                {t('online')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onNewPublication && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 gap-1 text-xs"
                onClick={onNewPublication}
              >
                <FileEdit className="w-3 h-3" />
                {t('newChat')}
              </Button>
            )}
            {isFloating && onClose && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {isOnboardingComplete && (
        <div className="px-3 py-2 border-b border-border flex gap-1.5 overflow-x-auto flex-shrink-0">
          <Badge variant="secondary" className="cursor-pointer hover:bg-[#1e3a5f]/20 whitespace-nowrap text-xs">
            <BookOpen className="w-3 h-3 mr-1" />
            {t('literature')}
          </Badge>
          <Badge variant="secondary" className="cursor-pointer hover:bg-[#1e3a5f]/20 whitespace-nowrap text-xs">
            <Quote className="w-3 h-3 mr-1" />
            {t('citations')}
          </Badge>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence>
          {chatMessages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
                message.role === 'assistant' 
                  ? 'bg-gradient-to-br from-[#1e3a5f] to-[#4a9b8c]' 
                  : 'bg-muted'
              }`}>
                {message.role === 'assistant' ? '🤖' : '👤'}
              </div>
              <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block p-2.5 rounded-xl max-w-[95%] ${
                  message.role === 'assistant'
                    ? 'bg-background border border-border text-left'
                    : 'bg-[#1e3a5f] text-white'
                }`}>
                  <div 
                    className="text-xs whitespace-pre-wrap prose prose-xs dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: message.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br/>') 
                    }}
                  />
                </div>
                
                {message.quickReplies && message.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {message.quickReplies.map((reply, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={() => handleQuickReply(reply)}
                      >
                        {reply}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isAiTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#4a9b8c] flex items-center justify-center text-xs">
              🤖
            </div>
            <div className="bg-background border border-border p-2.5 rounded-xl">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-3 border-t border-border bg-background flex-shrink-0">
        <div className="flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={t('chatPlaceholder')}
            className="flex-1 h-9 text-sm"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!chatInput.trim() || isAiTyping}
            size="sm"
            className="h-9 w-9 p-0 bg-gradient-to-r from-[#1e3a5f] to-[#4a9b8c]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// FLOATING BUTTON
// ============================================================================

export interface FloatingChatButtonProps {
  onClick: () => void
  isOpen: boolean
}

export function FloatingChatButton({ onClick, isOpen }: FloatingChatButtonProps) {
  const t = useTranslations('editor.aiAssistant')

  return (
    <Button
      onClick={onClick}
      className="fixed top-1/2 -translate-y-1/2 right-0 w-11 h-28 rounded-l-2xl rounded-r-none shadow-xl bg-gradient-to-b from-[#1e3a5f] to-[#4a9b8c] hover:from-[#2d4a6f] hover:to-[#5aab9c] hover:w-14 transition-all duration-200 z-50 flex flex-col items-center justify-center gap-2 border-l border-t border-b border-white/20"
      title={t('title')}
    >
      {isOpen ? (
        <X className="w-5 h-5 text-white" />
      ) : (
        <>
          <Sparkles className="w-5 h-5 text-white" />
          <span 
            className="text-[10px] text-white font-semibold tracking-wider"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {t('chatTab')}
          </span>
        </>
      )}
    </Button>
  )
}

