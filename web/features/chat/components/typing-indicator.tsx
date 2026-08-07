'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTyping } from '@/hooks/use-messaging'
import { cn } from '@/lib/utils'

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

  if (!typingUsers || typingUsers.length === 0) {
    return null
  }

  const renderTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].userName} is typing`
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`
    } else if (typingUsers.length === 3) {
      return `${typingUsers[0].userName}, ${typingUsers[1].userName} and ${typingUsers[2].userName} are typing`
    } else {
      return `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing`
    }
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