'use client'

/**
 * Mobile floating avatar → user menu.
 * Theme tokens (primary / davinci-beam / destructive). Labels from navigation i18n.
 * Catalog: lib/navigation/user-menu.ts + ring-config.navigation.userMenu.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Link, toAppHref } from '@/i18n/routing'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Menu,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useNotificationContext } from '@/features/notifications/components/notification-provider'
import { useOptionalStore } from '@/features/store/context'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/shared'
import { eventBus } from '@/lib/event-bus.client'
import { formatNativeBalance } from '@/features/wallet/utils/balance-cache'
import {
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
} from '@/lib/ring-config-client'
import { usePrimaryNativeBalance } from '@/hooks/use-primary-native-balance'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { getResolvedUserMenuItems } from '@/lib/navigation/user-menu'
import { getPrimaryNavIcon } from '@/lib/navigation/primary-nav-icons'
import { resolveNavLabel } from '@/lib/navigation/primary-nav'

interface MobileUserWidgetProps {
  className?: string
}

function resolveSessionAvatarSrc(user: {
  image?: string | null
  photoURL?: string | null
  avatarThumb?: string | null
}): string | null {
  return user.avatarThumb || user.image || user.photoURL || null
}

interface GridItemProps {
  icon: React.ComponentType<{ className?: string }>
  count?: number
  label: string
  description: string
  href: string
  index: number
  onNavigate: () => void
}

function GridItem({
  icon: Icon,
  count = 0,
  label,
  description,
  href,
  index,
  onNavigate,
}: GridItemProps) {
  return (
    <Link href={toAppHref(href)} onClick={onNavigate}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 600,
          damping: 25,
          delay: index * 0.03,
        }}
        className={cn(
          'relative group p-4 overflow-hidden text-left',
          davinciGlassSurface,
        )}
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            {count > 0 && (
              <div className="min-w-[28px] h-7 px-2 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center border-2 border-background">
                {count > 99 ? '99+' : count}
              </div>
            )}
          </div>
          <div className="font-semibold text-sm mb-1 text-foreground group-hover:text-primary transition-colors truncate">
            {label}
          </div>
          <div className="text-xs text-muted-foreground leading-tight truncate">
            {description}
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

export default function MobileUserWidget({ className }: MobileUserWidgetProps) {
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const t = useTranslations('navigation')
  const { data: session } = useSession()

  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef({ x: 0, y: 0 })

  const { balance: tokenBalance } = useCreditBalanceContext()
  const { unreadCount: notificationCount } = useNotificationContext()
  const store = useOptionalStore()
  const [favorites] = useLocalStorage<string[]>('ring_favorites', [])

  const cartCount = store?.totalItems || 0
  const [messagesCount] = useState(0)
  const creditBalanceUnitLabel = getClientCreditUnitLabel()
  const nativeSymbol = getClientNativeTokenSymbol()
  const {
    nativeTokenBalance,
    loading: nativeLoading,
    error: nativeError,
  } = usePrimaryNativeBalance({ enabled: isOpen && Boolean(session?.user?.id) })
  const avatarSrc = session?.user
    ? resolveSessionAvatarSrc(session.user as {
        image?: string | null
        photoURL?: string | null
        avatarThumb?: string | null
      })
    : null

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('mobile-widget-position')
    if (saved) {
      try {
        setPosition(JSON.parse(saved))
      } catch {
        setPosition({ x: window.innerWidth - 80, y: 80 })
      }
    } else {
      setPosition({ x: window.innerWidth - 80, y: 80 })
    }
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isOpen) {
      const touch = e.touches[0]
      dragStartPos.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      }
      setIsDragging(true)
    }
  }, [position, isOpen])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const touch = e.touches[0]
    const newX = touch.clientX - dragStartPos.current.x
    const newY = touch.clientY - dragStartPos.current.y
    const maxX = window.innerWidth - 70
    const maxY = window.innerHeight - 70
    setPosition({
      x: Math.max(10, Math.min(newX, maxX)),
      y: Math.max(10, Math.min(newY, maxY)),
    })
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    localStorage.setItem('mobile-widget-position', JSON.stringify(position))
  }, [position])

  const handleClick = useCallback(() => {
    if (!isDragging) {
      setIsOpen((prev) => !prev)
    }
  }, [isDragging])

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

  const walletDescription = (() => {
    const creditPart = `${formatBalance(tokenBalance?.amount ?? null)} ${creditBalanceUnitLabel}`
    if (nativeLoading && nativeTokenBalance === null) {
      return `${creditPart} · …`
    }
    if (nativeError && nativeTokenBalance === null) {
      return `${creditPart} · — ${nativeSymbol}`
    }
    const nativePart = `${formatNativeBalance(nativeTokenBalance ?? '0')} ${nativeSymbol}`
    return `${creditPart} · ${nativePart}`
  })()

  const counts = useMemo(
    () => ({
      notifications: notificationCount,
      cart: cartCount,
      favorites: favorites.length,
      messages: messagesCount,
    }),
    [notificationCount, cartCount, favorites.length, messagesCount],
  )

  const menuItems = useMemo(
    () =>
      getResolvedUserMenuItems(locale).map((item) => ({
        id: item.id,
        href: item.href,
        icon: getPrimaryNavIcon(item.icon),
        label: resolveNavLabel(t, item.labelKeys),
        description:
          item.id === 'wallet'
            ? walletDescription
            : item.descriptionKeys.length
              ? resolveNavLabel(t, item.descriptionKeys)
              : '',
        count: counts[item.id as keyof typeof counts] ?? 0,
      })),
    [locale, t, walletDescription, counts],
  )

  if (!session?.user || !mounted) return null

  const displayName = session.user.name || t('menu.anonymous')
  const badgeTotal = notificationCount + cartCount + messagesCount

  return (
    <div className="md:hidden">
      <motion.div
        className={cn(
          'fixed z-[8500]',
          isDragging && 'cursor-grabbing',
          !isOpen && 'cursor-grab',
          className,
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: 'none',
        }}
        animate={{
          scale: isDragging ? 1.1 : 1,
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
          <div
            className={cn(
              'absolute inset-0 rounded-full border-2',
              isOpen ? 'border-primary' : 'border-primary/40',
            )}
            style={{
              boxShadow: isOpen
                ? '0 0 24px color-mix(in oklch, var(--davinci-beam) 55%, transparent)'
                : '0 0 16px color-mix(in oklch, var(--davinci-beam) 28%, transparent)',
            }}
          />

          <div className="relative w-16 h-16 rounded-full bg-primary p-0.5 shadow-xl">
            <div className="w-full h-full rounded-full bg-background border-2 border-background overflow-hidden">
              <Avatar
                src={avatarSrc}
                alt={displayName}
                size="md"
                fallback={displayName.charAt(0) || 'U'}
                className="w-full h-full"
              />
            </div>

            <AnimatePresence>
              {!isOpen && !isDragging && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-background shadow-lg"
                >
                  <Menu className="w-3.5 h-3.5 text-primary-foreground" />
                </motion.div>
              )}
              {isOpen && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute bottom-0 right-0 w-6 h-6 bg-destructive rounded-full flex items-center justify-center border-2 border-background shadow-lg"
                >
                  <X className="w-3.5 h-3.5 text-destructive-foreground" />
                </motion.div>
              )}
            </AnimatePresence>

            {!isOpen && badgeTotal > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[24px] h-[24px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center border-2 border-background">
                {badgeTotal > 99 ? '99+' : badgeTotal}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[8400]"
            onClick={() => setIsOpen(false)}
            role="dialog"
            aria-label={t('userMenu')}
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
            <div
              className="pointer-events-none absolute -left-20 top-20 h-64 w-64 rounded-full blur-3xl bg-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]"
            />
            <div
              className="pointer-events-none absolute -right-20 bottom-40 h-64 w-64 rounded-full blur-3xl bg-[color-mix(in_oklch,var(--davinci-beam)_14%,transparent)]"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative h-full flex items-center justify-center p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-md">
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Avatar
                      src={avatarSrc}
                      alt={displayName}
                      size="lg"
                      fallback={displayName.charAt(0) || 'U'}
                      className="ring-2 ring-primary/50"
                    />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-1">
                    {displayName}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {menuItems.map((item, index) => (
                    <GridItem
                      key={item.id}
                      icon={item.icon}
                      count={item.count}
                      label={item.label}
                      description={item.description}
                      href={item.href}
                      index={index}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>

                <p className="text-center mt-8 text-muted-foreground text-sm">
                  {t('menu.tapOutside')}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
