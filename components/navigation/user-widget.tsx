'use client'

// ========================================================================
// Revolutionary 2025 User Widget
// - Highly interactive, visually modern user widget using glassmorphism UI
// - Leverages Framer Motion for micro-interactions
// - Real-time state hooks for counters & dynamic content
// ========================================================================

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link, toAppHref } from '@/i18n/routing'
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
import { ROUTES } from '@/constants/routes'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useNotificationContext } from '@/features/notifications/components/notification-provider'
import { useOptionalStore } from '@/features/store/context'
import {
  DEFAULT_CURRENCY,
  useStoreCurrency,
  resolveStorePriceCurrency,
} from '@/features/store/currency-context'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/shared'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'

// ========================================================================
// TYPES
// ========================================================================
interface UserWidgetProps {
  className?: string
  variant?: 'desktop' | 'mobile'
}

interface ActionButtonProps {
  icon: React.ReactNode
  count: number
  href: string
  label: string
  color: 'blue' | 'pink' | 'green' | 'purple'
  onClick?: () => void
}

interface HoverWidgetButtonProps {
  icon: React.ReactNode
  count: number
  label: string
  color: 'blue' | 'pink' | 'green' | 'purple'
  children: React.ReactNode
}

// ========================================================================
// ActionButton: Circular button for navigation actions, with real-time badge
// Features: 
// - Badge animates on value change
// - Color is theme-specific (blue, pink, green, purple)
// - Glass and scale hover effect
// ========================================================================
function ActionButton({ icon, count, href, label, color, onClick }: ActionButtonProps) {
  // Track previous count to detect changes
  const [prevCount, setPrevCount] = useState(count)
  const [justUpdated, setJustUpdated] = useState(false)

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
    <Link href={toAppHref(href)} onClick={onClick}>
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
        {/* Counter Badge: Shows only if count > 0, animates on change */}
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
        {/* Background Glow on hover */}
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

// ========================================================================
// HoverWidgetButton: Wraps a button with a hover panel (for Favorites & Cart)
// Features:
// - Shows badge w/ animation
// - Panel content is rendered as children
// ========================================================================
function HoverWidgetButton({ icon, count, label, color, children }: HoverWidgetButtonProps) {
  // Pulse animation on count change
  const [prevCount, setPrevCount] = useState(count)
  const [justUpdated, setJustUpdated] = useState(false)
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
        {/* Glow on hover */}
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
      {/* Floating panel on hover (children) */}
      {children}
    </div>
  )
}

// ========================================================================
// FavoritesWidget: Shows user's "Favorite" store items on hover
// - Uses localStorage state for favorites
// - Merges "enhanced" and legacy products to find actual favorite products
// - Panel appears on hover of icon
// ========================================================================
function FavoritesWidget() {
  const locale = useLocale() as Locale
  // favorites: list of IDs in localStorage
  const [favorites, setFavorites] = useLocalStorage<string[]>('ring_favorites', [])
  const store = useOptionalStore()
  const [open, setOpen] = useState(false)
  // STUB: Technically, mounted is unnecessary with Next.js 13+ w/ 'use client'
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const t = useTranslations('modules.store.favorites')

  // Handle mount state: prevent SSR hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Hover logic: show panel while mouse is over button or panel
  useEffect(() => {
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
  // Find actual product records represented by the favorite IDs. Merge enhanced/legacy.
  const resolved = useMemo(() => {
    // allProducts = enhancedProducts + products
    const enhancedList = store?.enhancedProducts || []
    const legacyList = store?.products || []
    const allProducts = [...enhancedList, ...legacyList]
    // Map favorite IDs to product objects, filter out deleted/missing
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
        {/* Hover panel: only rendered while open */}
        {open && (
          <div
            className="fixed left-[5.5rem] top-[8rem] w-[320px] max-h-[calc(100vh-140px)] bg-card/98 backdrop-blur-xl border border-border rounded-lg z-20 overflow-y-auto shadow-2xl"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <div className="p-4">
              {/* Panel header: Heart icon, "Favorites", total count */}
              <div className="flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-pink-500" />
                <span className="font-semibold">{t('button')}</span>
                <Badge variant="secondary">{resolved.length}</Badge>
              </div>
              {/* If empty, show "no favorites" message */}
              {resolved.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {t('empty')}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* List of favorite products */}
                  {resolved.map(p => (
                    <div key={p.id} className="p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={toAppHref(`${ROUTES.STORE(locale)}/${p.id}`)}
                            className="block font-medium text-sm hover:text-primary transition-colors truncate"
                            onClick={() => setOpen(false)}
                          >
                            {p.name}
                          </Link>
                          {p.price && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {typeof p.price === 'number' ? p.price.toFixed(2) : p.price}{' '}
                            {p.currency || DEFAULT_CURRENCY}
                            </div>
                          )}
                        </div>
                        {/* Remove from favorites */}
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
                  {/* Browse Store link */}
                  <div className="border-t border-border pt-3 mt-4">
                    <Link
                      className="w-full text-center py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium block"
                      href={toAppHref(ROUTES.STORE(locale))}
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

// ========================================================================
// CartWidget: Shows cart contents on hover
// - Uses shared store context
// - Real-time display of cart items, quantity, total, removal
// - Integrates 'useDisplayPrice' for formatting
// ========================================================================
function CartWidget() {
  const locale = useLocale() as Locale
  const store = useOptionalStore()
  const { currency, convertPrice, formatPrice, defaultCurrency } = useStoreCurrency()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tCommon = useTranslations('common')
  const tStore = useTranslations('modules.store')

  // Set mounted (SSR hydration fix if required by localStorage/etc.)
  useEffect(() => setMounted(true), [])

  // Hover logic for the floating panel
  useEffect(() => {
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

  // Precompute cart state (hooks above — never call useDisplayPrice inside conditionals)
  const cartItems = store?.cartItems || []
  const totalItems = store?.totalItems || 0
  const cartTotalLabel = useMemo(() => {
    const total = cartItems.reduce((sum, item) => {
      const priceDefaultCurrency =
        item.finalPrice != null ? item.finalPrice : parseFloat(item.product.price || '0')
      const from = resolveStorePriceCurrency(item.product.currency || defaultCurrency)
      return sum + convertPrice(priceDefaultCurrency, from, currency) * item.quantity
    }, 0)
    return formatPrice(total, currency)
  }, [cartItems, convertPrice, currency, defaultCurrency, formatPrice])

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
              {/* Cart panel header: cart icon, total count */}
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="h-5 w-5 text-green-500" />
                <span className="font-semibold">{tStore('cart.title')}</span>
                <Badge variant="secondary">{totalItems}</Badge>
              </div>
              {/* If empty cart */}
              {cartItems.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {tStore('cart.empty')}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Map each cart entry */}
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
                  {/* Show total, navigation links */}
                  <div className="border-t border-border pt-3 mt-4">
                    <div className="text-sm font-medium mb-3">
                      {tStore('cart.total')}: {cartTotalLabel}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        className="flex-1 text-center py-2 px-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                        href={toAppHref(ROUTES.CART(locale))}
                        onClick={() => setOpen(false)}
                      >
                        {tStore('cart.title')}
                      </Link>
                      <Link
                        className="flex-1 text-center py-2 px-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors text-sm font-medium"
                        href={toAppHref(ROUTES.CHECKOUT(locale))}
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

// ========================================================================
// Main UserWidget: Entry point, displays avatar, balance, and buttons
// ========================================================================
export default function UserWidget({ className, variant = 'desktop' }: UserWidgetProps) {
  const router = useRouter()
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  // Hydration deviation prevention for persistent client-side state
  const [mounted, setMounted] = useState(false)

  // Read up-to-date info from global contexts
  const { balance: tokenBalance, isLoading: balanceLoading } = useCreditBalanceContext()
  const { unreadCount: notificationCount } = useNotificationContext()
  const store = useOptionalStore()
  const [favorites] = useLocalStorage<string[]>('ring_favorites', [])

  // Cart count derived from store context
  const cartCount = store?.totalItems || 0

  // STUB: Messages count handling - needs backend integration for real messages (see below)
  const [messagesCount, setMessagesCount] = useState(0)

  useEffect(() => {
    setMounted(true)
    // STUB: Implement unread messages counter fetch to sync with backend
    // STUB: Could be implemented using a 'useUnreadMessages' hook or SWR/fetch
    // TODO: Use the React 19 use hook + server actions for this once API is ready
    /*
    use(
      fetchUnreadMessagesCount()
      .then(count => setMessagesCount(count))
    )
    */
    // See: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions
  }, [])

  // Track status of visual balance-change effect (could be used for animating increment/decrement)
  const [showBalanceChange, setShowBalanceChange] = useState(false)

  // Format balance as rounded string with K/M suffixes
  const formatBalance = (balance: string | null) => {
    if (!balance || balance === '0') return '0.00'
    const num = parseFloat(balance)
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }
  const displayBalance = formatBalance(tokenBalance?.amount)
  const hasLowBalance = parseFloat(tokenBalance?.amount || '0') < 10

  // Only render after mounting (prevents SSR mismatch with localStorage/session state)
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
      {/* Decorative floating gradients (visual polish). Fixed position. */}
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

      {/* Avatar block: shows logo + user avatar in ring formation for branding */}
      <Link
        href={toAppHref(ROUTES.PROFILE(locale))}
        className="relative group block mb-4"
      >
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Branded background effect */}
          <motion.div
            className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 blur-xl"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [0.98, 1.02, 0.98]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* two medallion icons: logo and user avatar */}
          <div className="relative flex justify-center mb-3">
            {/* Left: Logo with colored ring */}
            <motion.div
              className="relative z-10"
              whileHover={{
                scale: 1.08,
                rotate: -3,
                y: -2
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-400/40 via-indigo-500/30 to-purple-400/40 blur-sm" />
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
            {/* Right: user avatar, overlapping */}
            <motion.div
              className="relative z-20 -ml-5"
              whileHover={{
                scale: 1.08,
                rotate: 3,
                y: -2
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-purple-400/40 via-pink-500/30 to-rose-400/40 blur-sm" />
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

              {/* Verified sparkle: only for verified users */}
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

          {/* Platform/project title + user name display */}
          <div className="text-center space-y-1">
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

      {/* ==== Balance Display ==== */}
      <Link href={toAppHref(ROUTES.WALLET(locale))} className="block">
        <motion.div
          className="relative mx-auto mb-4 group"
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          {/* Background glow based on balance */}
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
          {/* Container for inner balance display */}
          <div className={cn(
            "relative px-5 py-2.5 rounded-2xl",
            "bg-gradient-to-br from-background/90 to-background/70",
            "backdrop-blur-xl",
            "border border-purple-500/20 group-hover:border-purple-500/40",
            "shadow-lg shadow-purple-500/10",
            "transition-all duration-300"
          )}>
            {/* Shimmer animation sweeps once every few seconds */}
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
            {/* Balance value and badge */}
            <div className="relative flex items-center justify-center gap-3">
              <span className={cn(
                "text-2xl font-black tracking-tight",
                "bg-gradient-to-r bg-clip-text text-transparent",
                hasLowBalance
                  ? "from-amber-500 to-orange-500"
                  : "from-blue-500 via-indigo-500 to-purple-500"
              )}>
                {balanceLoading ? '···' : displayBalance}
              </span>
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                "bg-gradient-to-r",
                hasLowBalance
                  ? "from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400"
                  : "from-blue-500/20 to-purple-500/20 text-purple-600 dark:text-purple-400"
              )}>
                RING
              </div>
              {/* Upward trending icon, bounces if balance is low */}
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

      {/* ==== Action Row ==== */}
      <div className="flex items-center justify-between gap-2">
        {/* Notifications (blue) */}
        <ActionButton
          icon={<Bell className="w-5 h-5" />}
          count={notificationCount}
          href={`${ROUTES.PROFILE(locale)}?tab=notifications`}
          label="Notifications"
          color="blue"
        />

        {/* Favorites, Cart: show as floating hover widgets */}
        <FavoritesWidget />

        <CartWidget />

        {/* Messages (purple); STUB: badge should become real when unread messages API is available */}
        <ActionButton
          icon={<MessageCircle className="w-5 h-5" />}
          count={messagesCount}
          href={`${ROUTES.PROFILE(locale)}?tab=messages`}
          label="Messages"
          color="purple"
        />
      </div>
    </motion.div>
  )
}
