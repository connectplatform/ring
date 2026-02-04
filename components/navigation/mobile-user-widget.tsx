'use client'

/**
 * Mobile Floating User Widget - GTA-Inspired Design
 * 
 * Features:
 * - Floating radial menu extending from avatar button
 * - GTA-style HUD aesthetic (sophisticated, not cartoony)
 * - Touch-optimized with haptic feedback
 * - Smooth spring animations
 * - Drag-to-position support
 * - Auto-collapse on navigation
 * - Dark mode optimized with neon accents
 * 
 * Inspiration: GTA 5 phone menu + Modern mobile game HUDs
 * Tech: React 19 + Framer Motion + Touch events
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import {
  Bell,
  Heart,
  ShoppingCart,
  MessageCircle,
  User,
  Wallet,
  X,
  Menu
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { ROUTES } from '@/constants/routes'
import { useCreditBalance } from '@/hooks/use-credit-balance'
import { useUnreadCount } from '@/hooks/use-unread-count'
import { useOptionalStore } from '@/features/store/context'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n-config'
import { eventBus } from '@/lib/event-bus.client'

interface MobileUserWidgetProps {
  className?: string
}

/**
 * Grid Menu Item Component
 * GTA-inspired card with glassmorphism
 */
interface GridItemProps {
  icon: React.ReactNode
  count?: number
  label: string
  description: string
  href: string
  color: string
  gradientFrom: string
  gradientTo: string
  index: number
  onNavigate: () => void
}

function GridItem({ 
  icon, 
  count = 0, 
  label,
  description,
  href, 
  color,
  gradientFrom,
  gradientTo,
  index,
  onNavigate 
}: GridItemProps) {
  return (
    <Link href={href} onClick={onNavigate}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ 
          type: "spring", 
          stiffness: 600,
          damping: 25,
          delay: index * 0.03 // Fast staggered entrance
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "relative group",
          "p-4 rounded-2xl",
          "bg-gradient-to-br backdrop-blur-2xl",
          "border border-white/20",
          "shadow-xl hover:shadow-2xl",
          "transition-all duration-300",
          "overflow-hidden",
          `from-${gradientFrom} to-${gradientTo}`
        )}
        style={{
          background: `linear-gradient(135deg, ${color}15, ${color}25)`
        }}
      >
        {/* Animated background shine */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{
            x: ['-100%', '100%']
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Icon with counter */}
          <div className="flex items-center justify-between mb-2">
            <motion.div
              className={cn(
                "w-12 h-12 rounded-xl",
                "flex items-center justify-center",
                "shadow-lg"
              )}
              style={{ background: color }}
              whileHover={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 0.3 }}
            >
              {icon}
            </motion.div>

            {/* Counter badge */}
            {count > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="min-w-[28px] h-7 px-2 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg border-2 border-background"
              >
                {count > 99 ? '99+' : count}
              </motion.div>
            )}
          </div>

          {/* Label */}
          <div className="font-bold text-sm mb-1" style={{ color }}>
            {label}
          </div>

          {/* Description */}
          <div className="text-xs text-white/70 leading-tight">
            {description}
          </div>
        </div>

        {/* Glow effect on hover */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl -z-10"
          style={{ background: color }}
        />
      </motion.div>
    </Link>
  )
}

/**
 * Main Mobile User Widget
 */
export default function MobileUserWidget({ className }: MobileUserWidgetProps) {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  
  // Widget state
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef({ x: 0, y: 0 })
  
  // Real-time data
  const { balance: ringBalance } = useCreditBalance()
  const { unreadCount: notificationCount } = useUnreadCount()
  const store = useOptionalStore()
  const [favorites] = useLocalStorage<string[]>('ring_favorites', [])
  
  const cartCount = store?.totalItems || 0
  const [messagesCount] = useState(0) // TODO: Implement

  // Initialize position from localStorage
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('mobile-widget-position')
    if (saved) {
      try {
        setPosition(JSON.parse(saved))
      } catch {
        // Default to top-right
        setPosition({ x: window.innerWidth - 80, y: 80 })
      }
    } else {
      setPosition({ x: window.innerWidth - 80, y: 80 })
    }
  }, [])

  // Auto-close menu on navigation
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Handle touch events for dragging
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isOpen) { // Only allow dragging when menu is closed
      const touch = e.touches[0]
      dragStartPos.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      }
      setIsDragging(true)
    }
  }, [position, isOpen])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    
    const touch = e.touches[0]
    const newX = touch.clientX - dragStartPos.current.x
    const newY = touch.clientY - dragStartPos.current.y
    
    // Keep within safe bounds
    const maxX = window.innerWidth - 70
    const maxY = window.innerHeight - 70
    
    const boundedX = Math.max(10, Math.min(newX, maxX))
    const boundedY = Math.max(10, Math.min(newY, maxY))
    
    setPosition({ x: boundedX, y: boundedY })
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    localStorage.setItem('mobile-widget-position', JSON.stringify(position))
  }, [position])

  // Handle menu toggle (tap without drag)
  const handleClick = useCallback(() => {
    if (!isDragging) {
      setIsOpen(prev => !prev)
    }
  }, [isDragging])

  // Close menu and navigate
  const handleNavigate = useCallback(() => {
    setIsOpen(false)
    eventBus.emit('modal:close-all', {})
  }, [])

  const formatBalance = (balance: string | null) => {
    if (!balance || balance === '0') return '0'
    const num = parseFloat(balance)
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toFixed(0)
  }

  if (!session?.user || !mounted) return null

  // Grid menu items configuration - 3 rows x 2 columns
  const menuItems = [
    { 
      icon: <User className="w-6 h-6 text-white" />, 
      label: 'Profile', 
      description: 'View & edit profile',
      href: ROUTES.PROFILE(locale),
      color: '#3B82F6', // Blue
      gradientFrom: 'blue-500/20',
      gradientTo: 'cyan-500/20'
    },
    { 
      icon: <Wallet className="w-6 h-6 text-white" />, 
      label: 'Wallet', 
      description: `${formatBalance(ringBalance?.amount)} RING`,
      href: ROUTES.WALLET(locale),
      color: '#8B5CF6', // Purple
      gradientFrom: 'purple-500/20',
      gradientTo: 'violet-500/20'
    },
    { 
      icon: <Bell className="w-6 h-6 text-white" />, 
      count: notificationCount,
      label: 'Notifications', 
      description: 'Activity alerts',
      href: ROUTES.PROFILE(locale) + '?tab=notifications',
      color: '#06B6D4', // Cyan
      gradientFrom: 'cyan-500/20',
      gradientTo: 'blue-500/20'
    },
    { 
      icon: <ShoppingCart className="w-6 h-6 text-white" />, 
      count: cartCount,
      label: 'Cart', 
      description: 'Shopping items',
      href: ROUTES.CART(locale),
      color: '#10B981', // Green
      gradientFrom: 'green-500/20',
      gradientTo: 'emerald-500/20'
    },
    { 
      icon: <Heart className="w-6 h-6 text-white" />, 
      count: favorites.length,
      label: 'Favorites', 
      description: 'Saved products',
      href: ROUTES.STORE(locale) + '?filter=favorites',
      color: '#EC4899', // Pink
      gradientFrom: 'pink-500/20',
      gradientTo: 'rose-500/20'
    },
    { 
      icon: <MessageCircle className="w-6 h-6 text-white" />, 
      count: messagesCount,
      label: 'Messages', 
      description: 'Direct chats',
      href: ROUTES.PROFILE(locale) + '?tab=messages',
      color: '#F97316', // Orange
      gradientFrom: 'orange-500/20',
      gradientTo: 'amber-500/20'
    }
  ]

  return (
    <div className="md:hidden">
      {/* Floating Avatar Button */}
      <motion.div
        className={cn(
          "fixed z-[8500]",
          isDragging && "cursor-grabbing",
          !isOpen && "cursor-grab",
          className
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: 'none'
        }}
        animate={{
          scale: isDragging ? 1.1 : 1
        }}
      >
        <motion.div
          className="relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
          whileTap={{ scale: 0.9 }}
        >
          {/* Outer glow ring */}
          <motion.div
            className={cn(
              "absolute inset-0 rounded-full",
              "border-4",
              isOpen ? "border-blue-500" : "border-purple-500/50",
              "shadow-2xl"
            )}
            animate={{
              scale: isOpen ? 1.15 : [1, 1.05, 1],
              opacity: isOpen ? 1 : [0.5, 0.8, 0.5],
              boxShadow: isOpen 
                ? "0 0 30px rgba(59, 130, 246, 0.8)" 
                : "0 0 20px rgba(168, 85, 247, 0.4)"
            }}
            transition={{ 
              duration: isOpen ? 0.3 : 2, 
              repeat: isOpen ? 0 : Infinity 
            }}
          />

          {/* Avatar */}
          <div className={cn(
            "relative w-16 h-16 rounded-full",
            "bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600",
            "p-0.5",
            "shadow-2xl"
          )}>
            <div className="w-full h-full rounded-full bg-background border-2 border-background overflow-hidden">
              <Avatar
                src={session.user.image || session.user.photoURL}
                alt={session.user.name || 'User'}
                size="md"
                fallback={session.user.name?.charAt(0) || 'U'}
                className="w-full h-full"
              />
            </div>

            {/* Menu indicator */}
            <AnimatePresence>
              {!isOpen && !isDragging && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute bottom-0 right-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center border-2 border-background shadow-lg"
                >
                  <Menu className="w-3.5 h-3.5 text-white" />
                </motion.div>
              )}
              {isOpen && (
                <motion.div
                  initial={{ scale: 0, rotate: 0 }}
                  animate={{ scale: 1, rotate: 90 }}
                  exit={{ scale: 0, rotate: 0 }}
                  className="absolute bottom-0 right-0 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center border-2 border-background shadow-lg"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Total notifications indicator */}
            {!isOpen && (notificationCount + cartCount + messagesCount) > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 min-w-[24px] h-[24px] px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-background shadow-lg"
              >
                {notificationCount + cartCount + messagesCount > 99 
                  ? '99+' 
                  : notificationCount + cartCount + messagesCount}
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Full-Screen Grid Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[8400]"
            onClick={() => setIsOpen(false)}
          >
            {/* Layered background for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-purple-900/40 to-pink-900/40" />
            <div className="absolute inset-0 backdrop-blur-2xl" />
            <div className="absolute inset-0 bg-black/30" />

            {/* Grid Menu Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
              className="relative h-full flex items-center justify-center p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-md">
                {/* Header with user info */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-center mb-8"
                >
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Avatar
                      src={session.user.image || session.user.photoURL}
                      alt={session.user.name || 'User'}
                      size="lg"
                      fallback={session.user.name?.charAt(0) || 'U'}
                      className="ring-4 ring-blue-500/50"
                    />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {session.user.name || 'Anonymous'}
                  </h2>
                  <p className="text-sm text-white/70">
                    {formatBalance(ringBalance?.amount)} RING
                  </p>
                </motion.div>

                {/* 3x2 Grid of Action Cards */}
                <div className="grid grid-cols-2 gap-3">
                  {menuItems.map((item, index) => (
                    <GridItem
                      key={index}
                      {...item}
                      index={index}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>

                {/* Close hint */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-center mt-8 text-white/50 text-sm"
                >
                  Tap outside to close
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

