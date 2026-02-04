'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Avatar } from '@/components/ui/avatar'
import { useLocale } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'
import { eventBus } from '@/lib/event-bus.client'

interface MobileAvatarButtonProps {
  className?: string
}

/**
 * Mobile Avatar Button - Floating & Draggable
 *
 * Floating profile button with:
 * - Draggable positioning on mobile (stays within safe bounds)
 * - Auto-hides all active popups/modals before navigation
 * - Z-index 8500 (below mobile menu 9000, above modals 8000)
 * - Smooth animations and touch-optimized
 */
export default function MobileAvatarButton({ className = '' }: MobileAvatarButtonProps) {
  const router = useRouter()
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  
  // Draggable state
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Initialize position from localStorage or default to top-right
  useEffect(() => {
    const saved = localStorage.getItem('mobile-avatar-position')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPosition(parsed)
      } catch {
        // Default position (top-right with safe area)
        setPosition({ x: window.innerWidth - 60, y: 16 })
      }
    } else {
      setPosition({ x: window.innerWidth - 60, y: 16 })
    }
  }, [])

  // Handle drag start
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setDragStart({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    })
    setIsDragging(true)
  }

  // Handle drag move
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    
    const touch = e.touches[0]
    const newX = touch.clientX - dragStart.x
    const newY = touch.clientY - dragStart.y
    
    // Keep within safe bounds (16px padding)
    const maxX = window.innerWidth - 60
    const maxY = window.innerHeight - 120 // Account for bottom navigation
    
    const boundedX = Math.max(16, Math.min(newX, maxX))
    const boundedY = Math.max(16, Math.min(newY, maxY))
    
    setPosition({ x: boundedX, y: boundedY })
  }

  // Handle drag end
  const handleTouchEnd = () => {
    setIsDragging(false)
    // Save position to localStorage
    localStorage.setItem('mobile-avatar-position', JSON.stringify(position))
  }

  const handleClick = () => {
    // CRITICAL: Hide all active popups/modals before navigation
    // Uses event bus for clean, decoupled modal management
    eventBus.emit('modal:close-all', {})
    eventBus.emit('popup:close-all', {})

    // Small delay to allow modals to close smoothly
    setTimeout(() => {
      router.push(ROUTES.PROFILE(locale))
    }, 150)
  }

  if (!session?.user) return null

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none' // Prevent scroll while dragging
      }}
      className={`fixed z-[8500] p-0.5 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg hover:shadow-xl transition-all duration-200 ${isDragging ? 'scale-110 shadow-2xl' : 'hover:scale-105'} md:hidden ${className}`}
      aria-label="Go to profile (draggable)"
    >
      <div className="w-10 h-10 rounded-full bg-background border-2 border-background overflow-hidden">
        <Avatar
          src={session.user.image || undefined}
          alt={session.user.name || 'User'}
          size="sm"
          fallback={session.user.name?.charAt(0) || 'U'}
          className="w-full h-full"
        />
      </div>
      
      {/* Drag indicator (subtle dots) */}
      {!isDragging && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary/20 rounded-full flex items-center justify-center">
          <div className="w-1 h-1 bg-primary rounded-full"></div>
        </div>
      )}
    </button>
  )
}
