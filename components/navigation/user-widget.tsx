'use client'

/**
 * Revolutionary 2025 User Widget
 * 
 * Features:
 * - Glassmorphism design with frosted glass effect
 * - Avatar with online status indicator
 * - RING balance with shimmer effect
 * - 4-button action row: Notifications, Favorites, Cart, Messages
 * - Real-time counters with pulse animations
 * - Micro-interactions with Framer Motion
 * - Haptic feedback on hover/click
 * - Theme-aware colors
 * 
 * Tech Stack:
 * - React 19 (use hook, useOptimistic)
 * - Framer Motion (micro-interactions)
 * - Tailwind CSS 4 (glassmorphism)
 * - Real-time counters via hooks
 */

import React, { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, 
  Heart, 
  ShoppingCart, 
  MessageCircle,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import { useCreditBalance } from '@/hooks/use-credit-balance'
import { useUnreadCount } from '@/hooks/use-unread-count'
import { useOptionalStore } from '@/features/store/context'
import { useOptionalCurrency } from '@/features/store/currency-context'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n-config'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'

interface UserWidgetProps {
  className?: string
  variant?: 'desktop' | 'mobile'
}

/**
 * Action Button Component with Counter Badge
 * Features: Pulse animation when count changes, glassmorphism on hover
 */
interface ActionButtonProps {
  icon: React.ReactNode
  count: number
  href: string
  label: string
  color: 'blue' | 'pink' | 'green' | 'purple'
  onClick?: () => void
}

function ActionButton({ icon, count, href, label, color, onClick }: ActionButtonProps) {
  const [prevCount, setPrevCount] = useState(count)
  const [justUpdated, setJustUpdated] = useState(false)

  // Detect count changes for pulse effect
  useEffect(() => {
    if (count !== prevCount && count > 0) {
      setJustUpdated(true)
      setTimeout(() => setJustUpdated(false), 1000)
    }
    setPrevCount(count)
  }, [count, prevCount])

  const colorMap = {
    blue: {
      bg: 'from-blue-500/20 to-cyan-500/20',
      text: 'text-blue-400',
      badge: 'bg-blue-500',
      glow: 'shadow-blue-500/50'
    },
    pink: {
      bg: 'from-pink-500/20 to-rose-500/20',
      text: 'text-pink-400',
      badge: 'bg-pink-500',
      glow: 'shadow-pink-500/50'
    },
    green: {
      bg: 'from-green-500/20 to-emerald-500/20',
      text: 'text-green-400',
      badge: 'bg-green-500',
      glow: 'shadow-green-500/50'
    },
    purple: {
      bg: 'from-purple-500/20 to-violet-500/20',
      text: 'text-purple-400',
      badge: 'bg-purple-500',
      glow: 'shadow-purple-500/50'
    }
  }

  const colors = colorMap[color]

  return (
    <Link href={href} onClick={onClick}>
      <motion.div
        className={cn(
          "relative group",
          "w-12 h-12 rounded-full",
          "flex items-center justify-center",
          "bg-gradient-to-br backdrop-blur-xl",
          "border border-white/10",
          "transition-all duration-300",
          "hover:scale-110 hover:border-white/30",
          "cursor-pointer",
          colors.bg
        )}
        whileHover={{ 
          scale: 1.1,
          boxShadow: `0 8px 32px ${colors.glow}`
        }}
        whileTap={{ scale: 0.95 }}
        title={label}
      >
        {/* Icon */}
        <span className={cn("transition-colors duration-300", colors.text, "group-hover:scale-110")}>
          {icon}
        </span>

        {/* Counter Badge */}
        <AnimatePresence>
          {count > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                ...(justUpdated && {
                  scale: [1, 1.3, 1],
                  transition: { duration: 0.3 }
                })
              }}
              exit={{ scale: 0, opacity: 0 }}
              className={cn(
                "absolute -top-1 -right-1",
                "min-w-[20px] h-5 px-1.5",
                "rounded-full",
                "flex items-center justify-center",
                "text-white text-[10px] font-bold",
                "border-2 border-background",
                "shadow-lg",
                colors.badge,
                justUpdated && "animate-pulse"
              )}
            >
              {count > 99 ? '99+' : count}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hover glow effect */}
        <motion.div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-br opacity-0",
            "group-hover:opacity-20",
            "transition-opacity duration-300",
            "-z-10 blur-xl",
            colors.bg
          )}
        />
      </motion.div>
    </Link>
  )
}

/**
 * Smart Hover Widget Button
 * Wraps existing hover components with proper styling to match widget design
 */
interface HoverWidgetButtonProps {
  icon: React.ReactNode
  count: number
  label: string
  color: 'blue' | 'pink' | 'green' | 'purple'
  children: React.ReactNode
}

function HoverWidgetButton({ icon, count, label, color, children }: HoverWidgetButtonProps) {
  const [prevCount, setPrevCount] = useState(count)
  const [justUpdated, setJustUpdated] = useState(false)

  // Detect count changes for pulse effect
  useEffect(() => {
    if (count !== prevCount && count > 0) {
      setJustUpdated(true)
      setTimeout(() => setJustUpdated(false), 1000)
    }
    setPrevCount(count)
  }, [count, prevCount])

  const colorMap = {
    blue: {
      bg: 'from-blue-500/20 to-cyan-500/20',
      text: 'text-blue-400',
      badge: 'bg-blue-500',
      glow: 'shadow-blue-500/50'
    },
    pink: {
      bg: 'from-pink-500/20 to-rose-500/20',
      text: 'text-pink-400',
      badge: 'bg-pink-500',
      glow: 'shadow-pink-500/50'
    },
    green: {
      bg: 'from-green-500/20 to-emerald-500/20',
      text: 'text-green-400',
      badge: 'bg-green-500',
      glow: 'shadow-green-500/50'
    },
    purple: {
      bg: 'from-purple-500/20 to-violet-500/20',
      text: 'text-purple-400',
      badge: 'bg-purple-500',
      glow: 'shadow-purple-500/50'
    }
  }

  const colors = colorMap[color]

  return (
    <div className="relative">
      <motion.div
        className={cn(
          "relative group",
          "w-12 h-12 rounded-full",
          "flex items-center justify-center",
          "bg-gradient-to-br backdrop-blur-xl",
          "border border-white/10",
          "transition-all duration-300",
          "hover:scale-110 hover:border-white/30",
          "cursor-pointer",
          colors.bg
        )}
        whileHover={{ 
          scale: 1.1,
          boxShadow: `0 8px 32px ${colors.glow}`
        }}
        whileTap={{ scale: 0.95 }}
        title={label}
      >
        {/* Icon */}
        <span className={cn("transition-colors duration-300", colors.text, "group-hover:scale-110")}>
          {icon}
        </span>

        {/* Counter Badge */}
        <AnimatePresence>
          {count > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                ...(justUpdated && {
                  scale: [1, 1.3, 1],
                  transition: { duration: 0.3 }
                })
              }}
              exit={{ scale: 0, opacity: 0 }}
              className={cn(
                "absolute -top-1 -right-1",
                "min-w-[20px] h-5 px-1.5",
                "rounded-full",
                "flex items-center justify-center",
                "text-white text-[10px] font-bold",
                "border-2 border-background",
                "shadow-lg",
                colors.badge,
                justUpdated && "animate-pulse"
              )}
            >
              {count > 99 ? '99+' : count}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hover glow effect */}
        <motion.div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-br opacity-0",
            "group-hover:opacity-20",
            "transition-opacity duration-300",
            "-z-10 blur-xl",
            colors.bg
          )}
        />
      </motion.div>
      
      {/* Hover widget content */}
      {children}
    </div>
  )
}

/**
 * Smart Favorites Widget - Hover to preview
 */
function FavoritesWidget() {
  const locale = useLocale() as Locale
  const [favorites, setFavorites] = useLocalStorage<string[]>('ring_favorites', [])
  const store = useOptionalStore()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const t = useTranslations('modules.store.favorites')
  const tCommon = useTranslations('common')
  
  useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const node = containerRef.current
    if (!node) return
    let hoverWithin = false
    const onEnter = () => { hoverWithin = true; setOpen(true) }
    const onLeave = () => { hoverWithin = false; setTimeout(() => { if (!hoverWithin) setOpen(false) }, 200) }
    node.addEventListener('mouseenter', onEnter)
    node.addEventListener('mouseleave', onLeave)
    return () => {
      node.removeEventListener('mouseenter', onEnter)
      node.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  const resolved = React.useMemo(() => {
    const enhancedList = store?.enhancedProducts || []
    const legacyList = store?.products || []
    const allProducts = [...enhancedList, ...legacyList]
    return favorites
      .map(id => allProducts.find(p => p.id === id))
      .filter(Boolean) as Array<{ id: string; name: string; price?: string | number; currency?: string }>
  }, [favorites, store?.enhancedProducts, store?.products])

  return (
    <div className="relative" ref={containerRef}>
      <HoverWidgetButton
        icon={<Heart className="w-5 h-5" />}
        count={favorites.length}
        label="Favorites"
        color="pink"
      >
        {open && (
          <div
            className="fixed left-[5.5rem] top-[8rem] w-[320px] max-h-[calc(100vh-140px)] bg-card/98 backdrop-blur-xl border border-border rounded-lg z-20 overflow-y-auto shadow-2xl"
            onMouseEnter={() => setOpen(true)} 
            onMouseLeave={() => setOpen(false)}
          >
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-pink-500" />
                <span className="font-semibold">{t('button')}</span>
                <Badge variant="secondary">{resolved.length}</Badge>
              </div>
              {resolved.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {t('empty')}
                </div>
              ) : (
                <div className="space-y-3">
                  {resolved.map(p => (
                    <div key={p.id} className="p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`${ROUTES.STORE(locale)}/${p.id}`}
                            className="block font-medium text-sm hover:text-primary transition-colors truncate"
                            onClick={() => setOpen(false)}
                          >
                            {p.name}
                          </Link>
                          {p.price && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {typeof p.price === 'number' ? p.price.toFixed(2) : p.price} {p.currency || 'DAAR'}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setFavorites(favorites.filter(id => id !== p.id))}
                          className="text-destructive hover:text-destructive/80 text-sm ml-2 flex-shrink-0"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-border pt-3 mt-4">
                    <Link
                      className="w-full text-center py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium block"
                      href={ROUTES.STORE(locale)}
                      onClick={() => setOpen(false)}
                    >
                      {t('browseStore')}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </HoverWidgetButton>
    </div>
  )
}

/**
 * Smart Cart Widget - Hover to preview
 */
function CartWidget() {
  const locale = useLocale() as Locale
  const store = useOptionalStore()
  const currencyContext = useOptionalCurrency()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const tCommon = useTranslations('common')
  const tStore = useTranslations('modules.store')

  // Currency formatting
  const formatPrice = currencyContext?.formatPrice || ((price: number) => `${price.toFixed(2)} ₴`)
  const convertPrice = currencyContext?.convertPrice || ((price: number) => price)
  const selectedCurrency = currencyContext?.currency || 'UAH'
  
  useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const node = containerRef.current
    if (!node) return
    let hoverWithin = false
    const onEnter = () => { hoverWithin = true; setOpen(true) }
    const onLeave = () => { hoverWithin = false; setTimeout(() => { if (!hoverWithin) setOpen(false) }, 200) }
    node.addEventListener('mouseenter', onEnter)
    node.addEventListener('mouseleave', onLeave)
    return () => {
      node.removeEventListener('mouseenter', onEnter)
      node.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  const cartItems = store?.cartItems || []
  const totalItems = store?.totalItems || 0
  const totalPriceByCurrency = store?.totalPriceByCurrency || { DAAR: 0, DAARION: 0 }

  return (
    <div className="relative" ref={containerRef}>
      <HoverWidgetButton
        icon={<ShoppingCart className="w-5 h-5" />}
        count={totalItems}
        label="Shopping Cart"
        color="green"
      >
        {open && (
          <div
            className="fixed left-[9rem] top-[8rem] w-[320px] max-h-[calc(100vh-200px)] bg-card/98 backdrop-blur-xl border border-border rounded-lg z-20 overflow-y-auto shadow-2xl"
            onMouseEnter={() => setOpen(true)} 
            onMouseLeave={() => setOpen(false)}
          >
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="h-5 w-5 text-green-500" />
                <span className="font-semibold">{tStore('cart.title')}</span>
                <Badge variant="secondary">{totalItems}</Badge>
              </div>
              {cartItems.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {tStore('cart.empty')}
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map(i => (
                    <div key={i.product.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{i.product.name}</div>
                        <div className="text-xs text-muted-foreground">Qty: {i.quantity}</div>
                      </div>
                      <button
                        className="text-destructive hover:text-destructive/80 text-sm underline ml-2"
                        onClick={() => store?.removeFromCart(i.product.id)}
                      >
                        {tCommon('actions.remove')}
                      </button>
                    </div>
                  ))}
                  <div className="border-t border-border pt-3 mt-4">
                    <div className="text-sm font-medium mb-3">
                      {tStore('cart.total')}: {formatPrice(cartItems.reduce((sum, item) => {
                        const priceUAH = item.finalPrice || parseFloat(item.product.price || '0')
                        const convertedPrice = convertPrice(priceUAH)
                        return sum + (convertedPrice * item.quantity)
                      }, 0))}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        className="flex-1 text-center py-2 px-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                        href={ROUTES.CART(locale)}
                        onClick={() => setOpen(false)}
                      >
                        {tStore('cart.title')}
                      </Link>
                      <Link
                        className="flex-1 text-center py-2 px-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors text-sm font-medium"
                        href={ROUTES.CHECKOUT(locale)}
                        onClick={() => setOpen(false)}
                      >
                        Checkout
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </HoverWidgetButton>
    </div>
  )
}

/**
 * Main User Widget Component
 */
export default function UserWidget({ className, variant = 'desktop' }: UserWidgetProps) {
  const router = useRouter()
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  const [mounted, setMounted] = useState(false)

  // Real-time data hooks
  const { balance: ringBalance, isLoading: balanceLoading } = useCreditBalance()
  const { unreadCount: notificationCount } = useUnreadCount()
  const store = useOptionalStore()
  const [favorites] = useLocalStorage<string[]>('ring_favorites', [])
  
  // Cart count from store context
  const cartCount = store?.totalItems || 0
  
  // Messages count (TODO: implement unread messages hook)
  const [messagesCount, setMessagesCount] = useState(0)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
    // TODO: Fetch unread messages count
    // const fetchUnreadMessages = async () => {
    //   const response = await fetch('/api/messages?unreadOnly=true&stats=true')
    //   if (response.ok) {
    //     const data = await response.json()
    //     setMessagesCount(data.unreadCount || 0)
    //   }
    // }
    // fetchUnreadMessages()
  }, [])

  // Balance animation state
  const [showBalanceChange, setShowBalanceChange] = useState(false)

  const formatBalance = (balance: string | null) => {
    if (!balance || balance === '0') return '0.00'
    const num = parseFloat(balance)
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }

  const displayBalance = formatBalance(ringBalance?.amount)
  const hasLowBalance = parseFloat(ringBalance?.amount || '0') < 10

  if (!session?.user || !mounted) return null

  return (
    <motion.div
      className={cn(
        "relative",
        "bg-gradient-to-br from-background/80 to-muted/50",
        "backdrop-blur-2xl",
        "border border-white/10",
        "rounded-2xl",
        "p-4",
        "shadow-2xl shadow-black/20",
        variant === 'desktop' && "w-full",
        className
      )}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Floating orbs background effect */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <motion.div
          className="absolute top-2 right-2 w-24 h-24 bg-blue-500/8 rounded-full blur-2xl"
          animate={{
            x: [0, 15, 0],
            y: [0, -15, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-2 left-2 w-20 h-20 bg-purple-500/6 rounded-full blur-xl"
          animate={{
            x: [0, -15, 0],
            y: [0, 15, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════════════
          🎨 DA VINCI MASTERPIECE USER WIDGET 
          ═══════════════════════════════════════════════════════════════════════════════════
          Design Philosophy: Renaissance meets Digital
          - Overlapping circular portraits like classical medallion compositions
          - Golden ratio spacing and visual hierarchy
          - Cosmic flowing gradients inspired by the digital frontier
          - Breathing animations that feel alive
          - Typography that commands attention yet feels elegant
          ═══════════════════════════════════════════════════════════════════════════════════ */}
      
      {/* The Grand Portrait Composition */}
      <Link
        href={ROUTES.PROFILE(locale)}
        className="relative group block mb-4"
      >
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Ethereal Glow Background - Breathing effect */}
          <motion.div
            className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 blur-xl"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [0.98, 1.02, 0.98]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* The Medallion - Overlapping Portraits */}
          <div className="relative flex justify-center mb-3">
            {/* Logo Portrait - Left, slightly elevated */}
            <motion.div
              className="relative z-10"
              whileHover={{ 
                scale: 1.08,
                rotate: -3,
                y: -2
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {/* Outer glow ring */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-400/40 via-indigo-500/30 to-purple-400/40 blur-sm" />
              
              {/* Logo container - Circular with gradient border */}
              <div className="relative w-16 h-16 rounded-full p-[3px] bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-500 shadow-xl shadow-blue-500/30">
                <div className="w-full h-full rounded-full bg-background/95 backdrop-blur-sm p-2 flex items-center justify-center overflow-hidden">
                  <Image
                    src="/logo.svg"
                    alt="Ring Platform"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain drop-shadow-sm"
                    priority
                  />
                </div>
              </div>
            </motion.div>

            {/* Avatar Portrait - Right, overlapping */}
            <motion.div
              className="relative z-20 -ml-5"
              whileHover={{ 
                scale: 1.08,
                rotate: 3,
                y: -2
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {/* Outer glow ring */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-purple-400/40 via-pink-500/30 to-rose-400/40 blur-sm" />
              
              {/* Avatar container - Circular with gradient border */}
              <div className="relative w-16 h-16 rounded-full p-[3px] bg-gradient-to-br from-purple-400 via-pink-500 to-rose-500 shadow-xl shadow-purple-500/30">
                <div className="w-full h-full rounded-full overflow-hidden">
                  <Avatar
                    src={session.user.image || session.user.photoURL}
                    alt={session.user.name || 'User'}
                    size="lg"
                    fallback={session.user.name?.charAt(0) || 'U'}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Verified Sparkle - Floating above */}
              {session.user.isVerified && (
                <motion.div
                  className="absolute -top-1 -right-1 z-30"
                  animate={{
                    rotate: [0, 15, -15, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="p-1 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/50">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* Brand Typography - Elegant Stacked */}
          <div className="text-center space-y-1">
            {/* Project Name - Hero Typography */}
            <motion.div
              className="relative"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 bg-clip-text text-transparent drop-shadow-sm">
                Ring
              </span>
              <span className="font-light text-xl text-purple-600/80 dark:text-purple-400/80"> Platform</span>
            </motion.div>

            {/* User Name - Refined Secondary */}
            <motion.div
              className="flex items-center justify-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="h-px w-6 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
              <span className="font-medium text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                {session.user.name || 'Anonymous'}
              </span>
              <div className="h-px w-6 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
            </motion.div>
          </div>
        </motion.div>
      </Link>

      {/* RING Balance - Floating Gem Design */}
      <Link href={ROUTES.WALLET(locale)} className="block">
        <motion.div
          className="relative mx-auto mb-4 group"
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          {/* Gem glow effect */}
          <motion.div
            className={cn(
              "absolute inset-0 rounded-2xl blur-md",
              hasLowBalance 
                ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30" 
                : "bg-gradient-to-r from-blue-500/30 to-purple-500/30"
            )}
            animate={{
              opacity: [0.5, 0.8, 0.5],
              scale: [0.95, 1.02, 0.95]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Main balance container */}
          <div className={cn(
            "relative px-5 py-2.5 rounded-2xl",
            "bg-gradient-to-br from-background/90 to-background/70",
            "backdrop-blur-xl",
            "border border-purple-500/20 group-hover:border-purple-500/40",
            "shadow-lg shadow-purple-500/10",
            "transition-all duration-300"
          )}>
            {/* Shimmer sweep */}
            <motion.div
              className="absolute inset-0 rounded-2xl overflow-hidden"
              initial={false}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
              />
            </motion.div>

            <div className="relative flex items-center justify-center gap-3">
              {/* Balance amount */}
              <span className={cn(
                "text-2xl font-black tracking-tight",
                "bg-gradient-to-r bg-clip-text text-transparent",
                hasLowBalance 
                  ? "from-amber-500 to-orange-500" 
                  : "from-blue-500 via-indigo-500 to-purple-500"
              )}>
                {balanceLoading ? '···' : displayBalance}
              </span>

              {/* Currency badge */}
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                "bg-gradient-to-r",
                hasLowBalance 
                  ? "from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400" 
                  : "from-blue-500/20 to-purple-500/20 text-purple-600 dark:text-purple-400"
              )}>
                RING
              </div>

              {/* Trend indicator */}
              <motion.div
                animate={hasLowBalance ? { y: [0, -2, 0] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <TrendingUp className={cn(
                  "w-4 h-4",
                  hasLowBalance ? "text-amber-500" : "text-purple-500"
                )} />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Action Buttons Row - Hover for Favorites & Cart */}
      <div className="flex items-center justify-between gap-2">
        <ActionButton
          icon={<Bell className="w-5 h-5" />}
          count={notificationCount}
          href={ROUTES.PROFILE(locale) + '?tab=notifications'}
          label="Notifications"
          color="blue"
        />
        
        {/* Favorites - Hover to preview */}
        <FavoritesWidget />
        
        {/* Cart - Hover to preview */}
        <CartWidget />
        
        <ActionButton
          icon={<MessageCircle className="w-5 h-5" />}
          count={messagesCount}
          href={ROUTES.PROFILE(locale) + '?tab=messages'}
          label="Messages"
          color="purple"
        />
      </div>
    </motion.div>
  )
}

