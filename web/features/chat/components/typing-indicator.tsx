'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTyping } from '@/hooks/use-messaging'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface TypingIndicatorProps {
  conversationId: string
  className?: string
}

const TypingDots = () => (
  <div className="flex space-x-1">
    {[0, 1, 2].map((index) => (
      <motion.div
        key={index}
        className="w-2 h-2 bg-muted-foreground rounded-full"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          delay: index * 0.2,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
)

export function TypingIndicator({ conversationId, className }: TypingIndicatorProps) {
  const { typingUsers } = useTyping(conversationId)
  const t = useTranslations('modules.messenger')

  if (!typingUsers || typingUsers.length === 0) {
    return null
  }

  const renderTypingText = () => {
    if (typingUsers.length === 1) {
      return t('typingOne', { name: typingUsers[0].userName })
    } else if (typingUsers.length === 2) {
      return t('typingTwo', { name: typingUsers[0].userName, other: typingUsers[1].userName })
    } else if (typingUsers.length === 3) {
      return t('typingThree', {
        name: typingUsers[0].userName,
        second: typingUsers[1].userName,
        third: typingUsers[2].userName,
      })
    }
    return t('typingMany', {
      name: typingUsers[0].userName,
      count: typingUsers.length - 1,
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "flex items-center space-x-2 px-4 py-2 text-sm text-muted-foreground",
          className
        )}
      >
        <div className="flex-shrink-0">
          <TypingDots />
        </div>
        <span className="text-xs">
          {renderTypingText()}
        </span>
      </motion.div>
    </AnimatePresence>
  )
} 