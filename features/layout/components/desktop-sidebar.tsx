'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import {
  Users,
  Briefcase,
  Store,
  Wallet,
  FileText,
  ChevronDown,
  ChevronRight,
  User,
  Moon,
  Sun,
  Heart,
  ShoppingBag,
  Bell,
  Copy,
  Check,
  Languages
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { routing } from '@/i18n-config'
import packageInfo from '@/package.json'
import { MiniCart } from '@/features/store/components/mini-cart'
import { FavoritesMenu } from '@/features/store/components/favorites-menu'
import { NotificationCenter } from '@/features/notifications/components/notification-center'
import { useCreditBalance } from '@/hooks/use-credit-balance'
import { toast } from '@/hooks/use-toast'
import { Separator } from '@/components/ui/separator'
import dynamic from 'next/dynamic'
import type { Locale } from '@/i18n-config'

const AnimatedLogo = dynamic(() => import('@/components/common/widgets/animated-logo'), {
  ssr: false,
})

interface NavigationItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: string | number
  children?: NavigationItem[]
}

interface DesktopSidebarProps {
  className?: string
}

export default function DesktopSidebar({ className }: DesktopSidebarProps) {
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const router = useRouter()
  const { data: session } = useSession()
  const { setTheme, theme, systemTheme } = useTheme()
  const tEntities = useTranslations('modules.entities')
  const tOpp = useTranslations('modules.opportunities')
  const tStore = useTranslations('modules.store')

  // State for expandable sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']))
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)

  // Wallet balance hook for authenticated users
  const {
    balance: ringBalance,
    isLoading: balanceLoading,
    error: balanceError,
    refresh: refetchBalance
  } = useCreditBalance()

  // Fix hydration mismatch by only rendering auth UI after mount
  useEffect(() => {
    setMounted(true)
  }, [session])

  // WebSocket connection monitoring
  useEffect(() => {
    if (typeof window === 'undefined' || !mounted) return

    // Use the tunnel transport manager for connection status
    import('@/lib/tunnel/transport-manager').then(({ getTunnelTransportManager }) => {
      const checkStatus = () => {
        const manager = getTunnelTransportManager()
        setWsConnected(manager.isConnected())
      }

      // Initial check
      checkStatus()

      // Check periodically for status updates
      const interval = setInterval(checkStatus, 5000)

      return () => {
        clearInterval(interval)
      }
    }).catch(err => {
      console.error('Failed to load tunnel transport manager:', err)
      setWsConnected(false)
    })
  }, [mounted])

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const toggleTheme = useCallback(() => {
    const currentTheme = theme === 'system' ? systemTheme : theme
    setTheme(currentTheme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme, systemTheme])

  // Language switching functionality (from footer)
  const switchLocale = useCallback((newLocale: string) => {
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'
    const newPath = `/${newLocale}${pathWithoutLocale}`
    router.replace(newPath, { scroll: false })
  }, [pathname, router])

  const getLanguageName = useCallback((locale: string) => {
    switch (locale) {
      case 'en': return 'English'
      case 'uk': return 'Українська'
      case 'ru': return 'Русский'
      default: return locale.toUpperCase()
    }
  }, [])

  // Wallet address copy functionality
  const handleCopyAddress = useCallback(async () => {
    if (session?.user?.wallets?.[0]?.address) {
      try {
        await navigator.clipboard.writeText(session.user.wallets[0].address)
        setCopied(true)
        toast({
          title: "Address copied",
          description: "Wallet address copied to clipboard"
        })
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        toast({
          title: "Copy failed",
          description: "Failed to copy address",
          variant: "destructive"
        })
      }
    }
  }, [session?.user?.wallets])

  // Format wallet address for display
  const formatAddress = useCallback((address: string) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [])

  // Format RING balance for display
  const formatBalance = useCallback((balance: string | null) => {
    if (!balance || balance === '0') return '0.00'
    const num = parseFloat(balance)
    return num.toFixed(2)
  }, [])

  const navigationItems: NavigationItem[] = [
    // Ring Ecosystem Section
    {
      href: ROUTES.HOME(locale),
      label: 'Home',
      icon: <div className="h-4 w-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">🏠</span>
            </div>
    },
    {
      href: `/${locale}/global-impact`,
      label: 'Global Impact',
      icon: <div className="h-4 w-4 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">🌍</span>
            </div>
    },
    {
      href: `/${locale}/about-trinity`,
      label: 'Trinity Ukraine',
      icon: <div className="h-4 w-4 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">🇺🇦</span>
            </div>
    },
    {
      href: `/${locale}/token-economy`,
      label: 'RING Economy',
      icon: <div className="h-4 w-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">💎</span>
            </div>
    },
    {
      href: `/${locale}/ai-web3`,
      label: 'AI Meets Web3',
      icon: <div className="h-4 w-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">🤖</span>
            </div>
    },

    // Separator (visual divider)
    { href: '#', label: 'divider-platform', icon: <div /> },

    // Platform Features Section
    {
      href: ROUTES.ENTITIES(locale),
      label: tEntities('title'),
      icon: <Users className="h-4 w-4" />
    },
    {
      href: ROUTES.OPPORTUNITIES(locale),
      label: `${tOpp('opportunities')} (Ring Projects)`,
      icon: <Briefcase className="h-4 w-4" />
    },
    {
      href: ROUTES.STORE(locale),
      label: tStore('title'),
      icon: <Store className="h-4 w-4" />
    },
    {
      href: ROUTES.WALLET(locale),
      label: 'Wallet',
      icon: <Wallet className="h-4 w-4" />
    },
    {
      href: ROUTES.DOCS(locale),
      label: 'Documentation',
      icon: <FileText className="h-4 w-4" />
    },

    // Separator (visual divider)
    { href: '#', label: 'divider-get-started', icon: <div /> },

    // Get Started Section
    {
      href: `/${locale}/docs/getting-started`,
      label: 'Quick Start',
      icon: <div className="h-4 w-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">🚀</span>
            </div>
    },
    {
      href: `/${locale}/tools/deployment-calculator`,
      label: 'Deployment Calculator',
      icon: <div className="h-4 w-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">💡</span>
            </div>
    },
    {
      href: `${ROUTES.OPPORTUNITIES(locale)}?type=ring_customization`,
      label: 'Find Ring Developer',
      icon: <div className="h-4 w-4 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">🎯</span>
            </div>
    }
  ]

  const isActive = (href: string) => {
    if (href === ROUTES.HOME(locale)) {
      return pathname === ROUTES.HOME(locale)
    }
    return pathname.startsWith(href)
  }

  const NavItem = ({ item, level = 0 }: { item: NavigationItem; level?: number }) => {
    // Handle separator items
    if (item.label.startsWith('divider-')) {
      return (
        <div className="my-4 px-3">
          <Separator className="w-full" />
          <div className="text-xs text-muted-foreground font-medium mt-2 mb-2 px-1">
            {item.label === 'divider-platform' ? 'Platform Features' : 'Get Started'}
          </div>
        </div>
      )
    }

    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedSections.has(item.label)
    const active = isActive(item.href)

    return (
      <div>
        <Link
          href={item.href}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            active && "bg-accent text-accent-foreground",
            level > 0 && "ml-6"
          )}
        >
          {item.icon}
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <Badge variant="secondary" className="text-xs">
              {item.badge}
            </Badge>
          )}
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-auto"
              onClick={(e) => {
                e.preventDefault()
                toggleSection(item.label)
              }}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          )}
        </Link>
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {item.children.map((child, index) => (
              <NavItem key={index} item={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const currentTheme = theme === 'system' ? systemTheme : theme
  const walletAddress = session?.user?.wallets?.[0]?.address
  const displayBalance = formatBalance(ringBalance?.amount)
  const hasLowBalance = parseFloat(ringBalance?.amount || '0') < 1

  return (
    <div className={cn(
      "fixed left-0 top-0 h-full w-[280px] bg-background border-r border-border z-40",
      "hidden md:flex md:flex-col",
      className
    )}>
      {/* Logo Section */}
      <div className="p-4 border-b border-border">
        <Link href={ROUTES.HOME(locale)} className="flex items-center gap-3">
          {/* Animated Logo */}
          <div className="flex-shrink-0">
            <AnimatedLogo />
          </div>

          {/* Project Name */}
          <div className="flex flex-col">
            <span className="font-bold text-lg text-primary">Ring Platform</span>
            <p className="text-xs text-muted-foreground">Documentation Portal</p>
          </div>
        </Link>
      </div>

      {/* Quick Actions Row */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-center space-x-2">
          {/* Favorites */}
          <FavoritesMenu locale={locale} />

          {/* Mini Cart */}
          <MiniCart locale={locale} />

          {/* Notifications - Only show when user is authenticated */}
          {mounted && session && (
            <NotificationCenter />
          )}
        </div>
      </div>


      {/* Navigation Menu Items */}
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigationItems.map((item, index) => (
          <NavItem key={index} item={item} />
        ))}
      </div>

      {/* Token Balance Section */}
      {session?.user && mounted && (
        <div className="p-4 border-t border-border space-y-3">
          {/* RING Balance Display */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(ROUTES.WALLET(locale))}
            className="w-full flex items-center gap-2 px-3 py-2 h-auto bg-gradient-to-r from-green-50 to-blue-50 hover:from-green-100 hover:to-blue-100 dark:from-green-950/30 dark:to-blue-950/30 dark:hover:from-green-900/40 dark:hover:to-blue-900/40 rounded-lg border border-green-200/50 dark:border-green-800/30 transition-all duration-200"
            title="Click to manage your RING tokens"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">R</span>
            </div>
            <div className="flex flex-col items-start flex-1">
              <span className="text-[10px] text-muted-foreground leading-none">RING Balance</span>
              <span className={`text-sm font-semibold leading-none ${hasLowBalance ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {balanceLoading ? '...' : displayBalance}
              </span>
            </div>
            {hasLowBalance && (
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" title="Low balance" />
            )}
          </Button>

          {/* Wallet Address */}
          {walletAddress && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAddress}
              className="w-full flex items-center gap-2 px-3 py-2 h-auto bg-muted/30 hover:bg-muted/50 rounded-lg font-mono text-xs transition-all duration-200"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">{formatAddress(walletAddress)}</span>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 opacity-60" />
              )}
            </Button>
          )}
        </div>
      )}

      {/* Theme and Language Controls Row */}
      {mounted && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-center gap-3">
            {/* Theme Toggle - No label */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="flex-1 h-8 px-2"
            >
              {currentTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Language Switcher - No flags */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-8 px-2 justify-center">
                  <Languages className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-full">
                <DropdownMenuItem onClick={() => switchLocale('en')} className={locale === 'en' ? 'bg-accent' : ''}>
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchLocale('uk')} className={locale === 'uk' ? 'bg-accent' : ''}>
                  Українська
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchLocale('ru')} className={locale === 'ru' ? 'bg-accent' : ''}>
                  Русский
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Quick User Info */}
      {session?.user && mounted && (
        <div className="p-4">
          <Link
            href={ROUTES.PROFILE(locale)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
          >
            <Avatar
              src={session.user.image || session.user.photoURL}
              alt={session.user.name || 'User'}
              size="sm"
              fallback={session.user.name?.charAt(0) || 'U'}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session.user.name || 'Anonymous'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                View Profile
              </p>
            </div>
            <User className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      )}

      {/* Version, Links and Status Row - At the very bottom */}
      <div className="p-4 mt-auto">
        <div className="flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            v{packageInfo.version}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/privacy`}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Privacy
            </Link>
            <Link
              href={`/${locale}/contact`}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Contact
            </Link>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>Link:</span>
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}



