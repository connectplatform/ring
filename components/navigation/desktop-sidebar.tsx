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
  Clock,
  Monitor,
  ShoppingBag,
  Bell,
  Copy,
  Check,
  Languages,
  Coins,
  Globe,
  Zap,
  Rocket,
  Calculator,
  Settings,
  BarChart3,
  Shield,
  Database,
  Archive
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
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { toast } from '@/hooks/use-toast'
import { Separator } from '@/components/ui/separator'
import { useCurrency } from '@/features/store/currency-context'
import dynamic from 'next/dynamic'
import type { Locale } from '@/i18n-config'
import UserWidget from './user-widget'
import { TunnelIndicatorCompact } from './tunnel-indicator'

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
  isAuthenticating?: boolean
}

export default function DesktopSidebar({ className, isAuthenticating = false }: DesktopSidebarProps) {
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const router = useRouter()
  const { data: session } = useSession()
  const { setTheme, theme, systemTheme } = useTheme()
  const tEntities = useTranslations('modules.entities')
  const tOpp = useTranslations('modules.opportunities')
  const tStore = useTranslations('modules.store')
  const tNav = useTranslations('navigation')

  // State for expandable sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']))
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  
  // Currency from context
  const { currency, toggleCurrency } = useCurrency()

  // Wallet balance hook for authenticated users
  const {
    balance: ringBalance,
    isLoading: balanceLoading,
    error: balanceError,
    refresh: refetchBalance
  } = useCreditBalanceContext()

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

  // Smart 2-mode language toggle
  // Logic: Toggle between user's primary language and English (or English and Ukrainian if EN is primary)
  const getSmartLanguageToggle = useCallback(() => {
    // Get stored user preference (if any)
    const storedLocale = typeof window !== 'undefined' 
      ? (localStorage.getItem('ring-locale') as Locale || locale)
      : locale

    // Determine primary and secondary languages for toggle
    let primaryLang: Locale = storedLocale
    let secondaryLang: Locale = 'en'

    if (primaryLang === 'en') {
      // If English is primary, toggle to Ukrainian
      secondaryLang = 'uk'
    } else {
      // If any other language is primary, toggle to English
      secondaryLang = 'en'
    }

    // Current language in URL
    const currentLang = locale

    // Next language to toggle to
    const nextLang = currentLang === primaryLang ? secondaryLang : primaryLang

    return { currentLang, nextLang, primaryLang, secondaryLang }
  }, [locale])

  const switchLocale = useCallback((newLocale: Locale) => {
    // Store the new locale preference
    localStorage.setItem('ring-locale', newLocale)
    document.cookie = `ring-locale=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`

    // Replace the current locale in the pathname
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'
    const newPath = `/${newLocale}${pathWithoutLocale}`
    
    // Use window.location.href for FULL page reload to get new messages from Server Components
    window.location.href = newPath
  }, [pathname])

  const getLanguageName = useCallback((locale: string) => {
    switch (locale) {
      case 'en': return 'EN'
      case 'uk': return 'UA'
      case 'ru': return 'RU'
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

  // ═══════════════════════════════════════════════════════════════════════════════════
  // 🎨 DA VINCI NAVIGATION - Renaissance Digital Theme
  // Each item is a jewel in the navigation crown
  // ═══════════════════════════════════════════════════════════════════════════════════
  const navigationItems: NavigationItem[] = [
    // Main Platform Features
    {
      href: ROUTES.HOME(locale),
      label: tNav('mainNav.home'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-400 to-purple-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-blue-500/90 to-purple-600/90 flex items-center justify-center shadow-inner">
                <span className="text-[11px] drop-shadow-sm">🏠</span>
              </div>
            </div>
    },
    {
      href: ROUTES.ENTITIES(locale),
      label: tEntities('title'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-blue-500/90 to-cyan-600/90 flex items-center justify-center shadow-inner">
                <Users className="h-3 w-3 text-white drop-shadow-sm" />
              </div>
            </div>,
      badge: 'Hot'
    },
    {
      href: ROUTES.OPPORTUNITIES(locale),
      label: tOpp('opportunities'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-400 to-pink-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-purple-500/90 to-pink-600/90 flex items-center justify-center shadow-inner">
                <Briefcase className="h-3 w-3 text-white drop-shadow-sm" />
              </div>
            </div>,
      badge: 'New'
    },
    {
      href: ROUTES.STORE(locale),
      label: tStore('title'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-emerald-500/90 to-teal-600/90 flex items-center justify-center shadow-inner">
                <Store className="h-3 w-3 text-white drop-shadow-sm" />
              </div>
            </div>
    },
    
    // Platform Concepts Section (with divider)
    { 
      label: 'divider-concepts',
      href: '#',
      icon: null
    },
    {
      href: `/${locale}/docs/white-label/token-economics`,
      label: tNav('sidebar.ringEconomy'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-amber-500/90 to-orange-600/90 flex items-center justify-center shadow-inner">
                <Coins className="h-3 w-3 text-white drop-shadow-sm" />
              </div>
            </div>
    },
    {
      href: `/${locale}/about-trinity`,
      label: tNav('sidebar.trinityUkraine'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-rose-400 to-red-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-rose-500/90 to-red-600/90 flex items-center justify-center shadow-inner">
                <Heart className="h-3 w-3 text-white drop-shadow-sm" />
              </div>
            </div>
    },
    {
      href: `/${locale}/global-impact`,
      label: tNav('sidebar.globalImpact'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-cyan-500/90 to-blue-600/90 flex items-center justify-center shadow-inner">
                <Globe className="h-3 w-3 text-white drop-shadow-sm" />
              </div>
            </div>
    },
    {
      href: `/${locale}/ai-web3`,
      label: tNav('sidebar.aiMeetsWeb3'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-violet-500/90 to-purple-600/90 flex items-center justify-center shadow-inner">
                <Zap className="h-3 w-3 text-white drop-shadow-sm" />
              </div>
            </div>
    },
    
    // Documentation Quick Links
    { 
      label: 'divider-docs',
      href: '#',
      icon: null
    },
    {
      href: ROUTES.DOCS(locale),
      label: tNav('sidebar.documentation'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-slate-400 to-gray-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-slate-500/90 to-gray-600/90 flex items-center justify-center shadow-inner">
                <FileText className="h-3 w-3 text-white drop-shadow-sm" />
              </div>
            </div>
    },
    {
      href: `/${locale}/docs/getting-started`,
      label: tNav('sidebar.quickStart'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-orange-400 to-red-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-orange-500/90 to-red-600/90 flex items-center justify-center shadow-inner">
                <Rocket className="h-3 w-3 text-white drop-shadow-sm" />
              </div>
            </div>
    },
    {
      href: `/${locale}/deployment-calculator`,
      label: tNav('sidebar.deploymentCalculator'),
      icon: <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-400 to-blue-600 opacity-80" />
              <div className="absolute inset-[2px] rounded-md bg-gradient-to-br from-indigo-500/90 to-blue-600/90 flex items-center justify-center shadow-inner">
                <Calculator className="h-3 w-3 text-white drop-shadow-sm" />
              </div>
            </div>
    }
  ]

  const isActive = (href: string) => {
    if (href === ROUTES.HOME(locale)) {
      return pathname === ROUTES.HOME(locale)
    }
    return pathname.startsWith(href)
  }

  // ═══════════════════════════════════════════════════════════════════════════════════
  // 🎨 DA VINCI NAV ITEM - Each link is a masterpiece
  // Features: Gradient glow on hover, spring animations, elegant typography
  // ═══════════════════════════════════════════════════════════════════════════════════
  const NavItem = ({ item, level = 0 }: { item: NavigationItem; level?: number }) => {
    // Handle separator items
    if (item.label.startsWith('divider-')) {
      const dividerLabels: Record<string, string> = {
        'divider-platform': tNav('sidebar.platformFeatures'),
        'divider-concepts': 'Platform Concepts',
        'divider-docs': tNav('sidebar.getStarted')
      }
      
      return (
        <div className="my-5 px-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-purple-600/70 dark:text-purple-400/70 bg-background">
                {dividerLabels[item.label] || ''}
              </span>
            </div>
          </div>
        </div>
      )
    }

    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedSections.has(item.label)
    const active = isActive(item.href)

    return (
      <div className="relative group">
        {/* Active indicator - glowing bar */}
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-blue-400 to-purple-500 shadow-lg shadow-purple-500/50" />
        )}
        
        <Link
          href={item.href}
          className={cn(
            "relative flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm font-medium",
            "transition-all duration-300 ease-out",
            // Hover state - elegant lift with glow
            "hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-purple-500/10",
            "hover:shadow-md hover:shadow-purple-500/10",
            "hover:-translate-y-0.5 hover:scale-[1.02]",
            // Active state - prominent with glow
            active && "bg-gradient-to-r from-blue-500/15 to-purple-500/15 shadow-md shadow-purple-500/20",
            active && "text-purple-700 dark:text-purple-300",
            // Nested items
            level > 0 && "ml-6"
          )}
        >
          {/* Icon with hover glow effect */}
          <div className="relative">
            {item.icon}
            {/* Glow effect on hover */}
            <div className="absolute inset-0 rounded-lg bg-purple-500/0 group-hover:bg-purple-500/20 blur-md transition-all duration-300" />
          </div>
          
          {/* Label with gradient on active */}
          <span className={cn(
            "flex-1 transition-colors duration-200",
            active && "font-semibold"
          )}>
            {item.label}
          </span>
          
          {item.badge && (
            <Badge 
              variant="secondary" 
              className={cn(
                "text-[10px] px-1.5 py-0 h-5",
                "bg-gradient-to-r from-blue-500/20 to-purple-500/20",
                "border border-purple-500/30",
                "text-purple-700 dark:text-purple-300"
              )}
            >
              {item.badge}
            </Badge>
          )}
          
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-auto rounded-full hover:bg-purple-500/20"
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
          <div className="mt-1 ml-4 pl-4 border-l-2 border-purple-500/20">
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
      "fixed left-0 top-0 h-full w-[280px] z-40",
      "hidden md:flex md:flex-col",
      // Da Vinci background - subtle gradient with glassmorphism
      "bg-gradient-to-b from-background via-background to-purple-500/[0.02]",
      "backdrop-blur-xl",
      "border-r border-purple-500/10",
      className
    )}>
      {/* Decorative top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
      {/* Logo Section */}
      <div className="p-4 border-b border-border">
        <Link href={ROUTES.HOME(locale)} className="flex items-center gap-3">
          {/* Animated Logo */}
          <div className="flex-shrink-0">
            <AnimatedLogo />
          </div>

          {/* Project Name */}
          <div className="flex flex-col">
            <span className="font-bold text-xl text-primary">Ring Platform</span>
            <p className="text-[10px] text-muted-foreground leading-tight">AI Self-Construct</p>
          </div>
        </Link>
      </div>

      {/* Sign In Link for Unauthenticated Users - Moved to Top */}
      {!session?.user && mounted && (
        <div className="p-4 border-b border-border">
          <Link
            href={ROUTES.LOGIN(locale)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">🔐</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {tNav('sidebar.signIn')}
              </p>
              <p className="text-xs text-muted-foreground">
                {tNav('sidebar.accessAccount')}
              </p>
            </div>
            <User className="h-4 w-4 text-muted-foreground" />
          </Link>
            </div>
      )}

      {/* Revolutionary User Widget - 2025 Glassmorphism Design */}
      {session?.user && mounted && (
        <div className="p-4 border-b border-border">
          <UserWidget variant="desktop" />
        </div>
      )}

      {/* Navigation Menu Items */}
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigationItems.map((item, index) => (
          <React.Fragment key={index}>
            {/* Admin Menu Items - Only for Admin/SuperAdmin users - positioned above Main link */}
            {index === 0 && session?.user && mounted && (session.user.role === 'admin' || session.user.role === 'superadmin') && (
              <div className="mb-3 px-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                    {tNav('sidebar.admin')}
                  </span>
                </div>
                <div className="space-y-1">
                  <Link href={ROUTES.ADMIN(locale)} className="block">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 px-3 text-xs hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
                    >
                      <BarChart3 className="h-3 w-3 mr-2" />
                      {tNav('sidebar.adminDashboard')}
                    </Button>
                  </Link>
                  <Link href={ROUTES.ADMIN_USERS(locale)} className="block">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 px-3 text-xs hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
                    >
                      <Users className="h-3 w-3 mr-2" />
                      {tNav('sidebar.userManagement')}
                    </Button>
                  </Link>
                  <Link href={ROUTES.ADMIN_ANALYTICS(locale)} className="block">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 px-3 text-xs hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
                    >
                      <BarChart3 className="h-3 w-3 mr-2" />
                      {tNav('sidebar.analytics')}
                    </Button>
                  </Link>
                  <Link href={ROUTES.ADMIN_SECURITY(locale)} className="block">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 px-3 text-xs hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
                    >
                      <Shield className="h-3 w-3 mr-2" />
                      {tNav('sidebar.security')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            <NavItem item={item} />
          </React.Fragment>
        ))}
      </div>

      {/* Wallet Address - Only show if user has wallet */}
      {session?.user && mounted && walletAddress && (
        <div className="px-4 pb-2">
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
        </div>
      )}


      {/* ═══════════════════════════════════════════════════════════════════════════════════
          🎨 DA VINCI CONTROL PANEL - Elegant Settings Row
          Features: Gem-like buttons, gradient borders, premium feel
          ═══════════════════════════════════════════════════════════════════════════════════ */}
      <div className="px-4 py-3">
        <div className="relative">
          {/* Subtle top border with gradient */}
          <div className="absolute -top-3 left-4 right-4 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
          
          <div className="flex items-center gap-2">
            {/* Language Toggle - Gem Button */}
            <button
              onClick={() => {
                const { nextLang } = getSmartLanguageToggle()
                switchLocale(nextLang)
              }}
              className={cn(
                "relative flex-1 h-9 px-3 rounded-xl text-xs font-medium",
                "bg-gradient-to-br from-background to-muted/50",
                "border border-purple-500/20 hover:border-purple-500/40",
                "hover:shadow-md hover:shadow-purple-500/10",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-0.5",
                "flex items-center justify-center gap-1.5",
                "group"
              )}
              title={`Switch to ${(() => {
                const { nextLang } = getSmartLanguageToggle()
                return nextLang === 'en' ? 'English' : nextLang === 'uk' ? 'Українська' : 'Русский'
              })()}`}
            >
              <Languages className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent font-semibold">
                {getLanguageName(locale)}
              </span>
            </button>

            {/* Theme Toggle - Gem Button */}
            <button
              onClick={toggleTheme}
              className={cn(
                "relative flex-1 h-9 px-3 rounded-xl text-xs font-medium",
                "bg-gradient-to-br from-background to-muted/50",
                "border border-purple-500/20 hover:border-purple-500/40",
                "hover:shadow-md hover:shadow-purple-500/10",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-0.5",
                "flex items-center justify-center gap-1.5",
                "group"
              )}
              title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {currentTheme === 'dark' ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent font-semibold">
                    Dark
                  </span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 group-hover:rotate-45 transition-all" />
                  <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent font-semibold">
                    Light
                  </span>
                </>
              )}
            </button>

            {/* Currency Toggle - Gem Button */}
            {toggleCurrency && (
              <button
                onClick={toggleCurrency}
                className={cn(
                  "relative flex-1 h-9 px-3 rounded-xl text-xs font-medium",
                  "bg-gradient-to-br from-background to-muted/50",
                  "border border-purple-500/20 hover:border-purple-500/40",
                  "hover:shadow-md hover:shadow-purple-500/10",
                  "transition-all duration-300 ease-out",
                  "hover:-translate-y-0.5",
                  "flex items-center justify-center gap-1.5",
                  "group"
                )}
                title={`Switch to ${currency === 'UAH' ? 'RING' : 'UAH'}`}
              >
                <Coins className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:rotate-12 transition-all" />
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent font-semibold">
                  {currency === 'UAH' ? '₴' : 'Ⓡ'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════════════
          🎨 DA VINCI FOOTER - Elegant Status & Links
          ═══════════════════════════════════════════════════════════════════════════════════ */}
      <div className="px-4 pb-4 pt-2">
        <div className="relative">
          {/* Connection status with breathing animation */}
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  wsConnected ? "bg-purple-500" : "bg-red-500"
                )} />
                {wsConnected && (
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-purple-500 animate-ping opacity-75" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium",
                wsConnected ? "text-purple-600 dark:text-purple-400" : "text-red-500"
              )}>
                {wsConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Version and links - elegant typography */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Tunnel connection indicator - green dot when connected */}
              <TunnelIndicatorCompact />
              <Link
                href={`/${locale}/about-trinity`}
                className="group flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              >
                <span className="font-mono">v{packageInfo.version}</span>
                <span className="text-purple-500/50">•</span>
                <span className="group-hover:underline underline-offset-2">Trinity</span>
              </Link>
            </div>
            
            <div className="flex items-center gap-1">
              <Link
                href={`/${locale}/privacy`}
                className="px-2 py-1 text-[10px] font-medium text-muted-foreground/60 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 rounded-md transition-all"
              >
                Privacy
              </Link>
              <span className="text-muted-foreground/30">|</span>
              <Link
                href={`/${locale}/contact`}
                className="px-2 py-1 text-[10px] font-medium text-muted-foreground/60 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 rounded-md transition-all"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}




