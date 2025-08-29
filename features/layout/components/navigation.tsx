'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { 
  Moon, 
  Sun, 
  Menu, 
  User, 
  LogIn, 
  Heart, 
  Store, 
  Users, 
  Briefcase,
  Wallet,
  Settings,
  ShoppingBag,
  Copy,
  Check,
  Plus
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import UnifiedLoginComponent from '@/features/auth/components/unified-login-component'
import { NotificationCenter } from '@/features/notifications/components/notification-center'

import { signIn, signOut, useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { MiniCart } from '@/features/store/components/mini-cart'
import { FavoritesMenu } from '@/features/store/components/favorites-menu'
import { LanguageSwitcher } from '@/components/common/language-switcher'
import { useCreditBalance } from '@/hooks/use-credit-balance'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n-config'

// React 19 Resource Preloading APIs
import { preload, preinit } from 'react-dom'

const AnimatedLogo = dynamic(() => import('@/components/common/widgets/animated-logo'), {
  ssr: false,
})

const MobileMenu = dynamic(() => import('./mobile-menu'), {
  ssr: false,
})

// Use runtime locale from next-intl

/**
 * Navigation component for the application
 * 
 * This component handles the main navigation bar, including:
 * - Logo and brand name
 * - Navigation links
 * - Theme toggle
 * - Language toggle
 * - Notification center
 * - User authentication status and actions
 * - Mobile menu for responsive design
 *
 * User steps:
 * 1. View the navigation bar with logo and links
 * 2. Toggle between light and dark themes
 * 3. Switch between English and Ukrainian languages
 * 4. View and manage notifications
 * 5. Sign in or out of the application
 * 6. Access user profile or additional options when signed in
 * 7. Use the mobile menu on smaller screens
 *
 * @returns {React.ReactElement} The rendered Navigation component
 */
export default function Navigation() {
  const tCommon = useTranslations('common')
  const tEntities = useTranslations('modules.entities')
  const tOpp = useTranslations('modules.opportunities')
  const tStore = useTranslations('modules.store')
  const locale = useLocale() as Locale
  const { setTheme, theme, systemTheme } = useTheme()
  const router = useRouter()
  
  const { data: session, status } = useSession()
  
  const [isOpen, setIsOpen] = useState(false)
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false)
  const [showHeader, setShowHeader] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)

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
    
    // React 19 Resource Preloading - Navigation Performance Optimization
  
    // Preinit navigation-related scripts
    // preinit('/scripts/navigation-analytics.js', { as: 'script' })
    // preinit('/scripts/theme-persistence.js', { as: 'script' })
    
    // Preload authentication-related resources
    //if (!session) {
      // preload('/api/auth/providers', { as: 'fetch' })
      // preload('/images/auth-background.webp', { as: 'image' })
    //}
    
    // Preload user-specific resources if authenticated
    //  if (session?.user) {
      // preload(`/api/users/${session.user.id}`, { as: 'fetch' })
      // preload('/api/notifications', { as: 'fetch' })
      // if (session.user.image) {
        // preload(session.user.image, { as: 'image' })
      // }
    //}
  }, [session])

  // Enhanced navigation items with icons and improved organization
  const navigationItems = [
    { 
      href: ROUTES.ENTITIES(locale), 
      label: tEntities('title'),
      icon: <Users className="h-4 w-4" />,
      description: 'Browse and manage entities'
    },
    { 
      href: ROUTES.OPPORTUNITIES(locale), 
      label: tOpp('opportunities'),
      icon: <Briefcase className="h-4 w-4" />,
      description: 'Discover opportunities'
    },
    { 
      href: ROUTES.STORE(locale), 
      label: tStore('title'),
      icon: <Store className="h-4 w-4" />,
      description: 'Multi-vendor marketplace'
    },
    { 
      href: ROUTES.WALLET(locale), 
      label: 'Wallet',
      icon: <Wallet className="h-4 w-4" />,
      description: 'Manage your RING tokens'
    }
  ]

  // Additional user menu items for authenticated users
  const userMenuItems = [
    {
      href: ROUTES.PROFILE(locale),
      label: tCommon('labels.profile'),
      icon: <User className="h-4 w-4" />
    },
    {
      href: ROUTES.SETTINGS(locale),
      label: 'Account Settings',
      icon: <Settings className="h-4 w-4" />
    },
    {
      href: `/${locale}/store/settings`,
      label: 'Store Settings',
      icon: <Store className="h-4 w-4" />
    },
    {
      href: ROUTES.STORE_ORDERS(locale),
      label: 'My Orders',
      icon: <ShoppingBag className="h-4 w-4" />
    },
    {
      href: ROUTES.MEMBERSHIP(locale),
      label: 'Membership',
      icon: <Heart className="h-4 w-4" />
    }
  ]

  const currentTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    let lastScrollY = window.scrollY
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (window.scrollY - lastScrollY > 10) {
            setShowHeader(false)
          } else if (lastScrollY - window.scrollY > 10) {
            setShowHeader(true)
          }
          lastScrollY = window.scrollY
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleOpenLoginDialog = useCallback(() => {
    setIsLoginDialogOpen(true)
  }, [])

  const handleCloseLoginDialog = useCallback(async () => {
    setIsLoginDialogOpen(false)
  }, [])

  // Open login selector instead of directly triggering Google
  const handleOpenLoginSelector = useCallback(() => {
    setIsOpen(false)
    setIsLoginDialogOpen(true)
  }, [])

  const handleSignOut = useCallback(async () => {
    setIsOpen(false)
    try {
      await signOut({ redirect: false })
      router.push(`/${locale}/auth/signout`)
    } catch (error) {
      console.error('Sign out error:', error)
      setError(tCommon('status.error'))
    }
  }, [tCommon, router, locale])

  // Language switching is now handled by LanguageSwitcher component

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark')
  }, [setTheme, currentTheme])

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

  // Modern wallet balance component
  const WalletBalanceSection = () => {
    if (!session?.user || !mounted) return null

    const walletAddress = session.user.wallets?.[0]?.address
    const displayBalance = formatBalance(ringBalance?.amount)
    const hasLowBalance = parseFloat(ringBalance?.amount || '0') < 1

    return (
      <div className="flex items-center gap-3">
        {/* Wallet Address Pill */}
        {walletAddress && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyAddress}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 h-8 bg-muted/50 hover:bg-muted/80 rounded-full font-mono text-xs transition-all duration-200"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>{formatAddress(walletAddress)}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 opacity-60" />
            )}
          </Button>
        )}

        {/* RING Balance Display */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(ROUTES.WALLET(locale))}
            className="flex items-center gap-2 px-3 py-1.5 h-8 bg-gradient-to-r from-green-50 to-blue-50 hover:from-green-100 hover:to-blue-100 dark:from-green-950/30 dark:to-blue-950/30 dark:hover:from-green-900/40 dark:hover:to-blue-900/40 rounded-full border border-green-200/50 dark:border-green-800/30 transition-all duration-200"
            title="Click to manage your RING tokens"
          >
            <div className="w-4 h-4 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">R</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] text-muted-foreground leading-none">RING</span>
              <span className={`text-xs font-semibold leading-none ${hasLowBalance ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {balanceLoading ? '...' : displayBalance}
              </span>
            </div>
            {hasLowBalance && (
              <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Low
              </Badge>
            )}
          </Button>
          
          {/* Quick Top-up Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`${ROUTES.WALLET(locale)}?action=topup`)}
            className="h-8 w-8 p-0 rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
            title="Top up RING balance"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <nav className={`sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
        {/* Main Navigation Row */}
        <div className="flex justify-between items-center px-4 py-3">
          <Link href={ROUTES.HOME(locale)} className="flex items-center gap-3" aria-label={tCommon('labels.homeLink')}>
            <div className="w-10 h-10">
              <AnimatedLogo />
            </div>
            <span className="font-bold text-xl">
              <span
                className="bg-gradient-to-r from-blue-500 via-green-400 to-green-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-green-300 dark:to-green-400"
                style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                Ring
              </span>
            </span>
          </Link>

          {/* Enhanced Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {mounted ? navigationItems.map(({ href, label, icon, description }) => (
              <Button 
                key={href} 
                variant="ghost" 
                size="sm"
                asChild
                className="flex items-center gap-2 px-3 py-2 h-9 hover:bg-muted/80 transition-all duration-200 group"
              >
                <Link href={href} title={description}>
                  <span className="group-hover:scale-110 transition-transform duration-200">
                    {icon}
                  </span>
                  <span className="font-medium">{label}</span>
                </Link>
              </Button>
            )) : (
              // Enhanced loading placeholders
              <>
                <div className="w-20 h-9 animate-pulse bg-muted/50 rounded-md"></div>
                <div className="w-24 h-9 animate-pulse bg-muted/50 rounded-md"></div>
                <div className="w-16 h-9 animate-pulse bg-muted/50 rounded-md"></div>
                <div className="w-18 h-9 animate-pulse bg-muted/50 rounded-md"></div>
              </>
            )}
            
            {/* Right Side Actions */}
            <div className="flex items-center gap-2 ml-4">
              {/* Theme Toggle */}
              {mounted ? (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleTheme} 
                  aria-label={tCommon('labels.toggleTheme')}
                  className="h-8 w-8 p-0"
                >
                  {currentTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              ) : (
                <div className="w-8 h-8 animate-pulse bg-muted/50 rounded"></div>
              )}
              
              {/* Language Switcher */}
              {mounted ? (
                <LanguageSwitcher />
              ) : (
                <div className="w-12 h-8 animate-pulse bg-muted/50 rounded"></div>
              )}
              
              {/* Favorites & MiniCart */}
              <FavoritesMenu locale={locale} />
              <MiniCart locale={locale} />
              
              {/* Notification Center - Only show when user is authenticated */}
              {mounted && session && (
                <NotificationCenter />
              )}
              
              {/* Wallet Balance Section - Only for authenticated users */}
              <WalletBalanceSection />
              
              {/* User Menu or Sign In */}
              {!mounted ? (
                <div className="w-24 h-9 animate-pulse bg-muted/50 rounded"></div>
              ) : status === 'loading' ? (
                <div className="animate-pulse text-sm">Loading...</div>
              ) : session ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex items-center gap-2 px-3 py-2 h-9"
                      aria-label={tCommon('labels.userMenu')}
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="hidden lg:block text-sm font-medium">
                        {session.user?.name?.split(' ')[0] || 'User'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {userMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onSelect={() => router.push(item.href)}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onSelect={handleSignOut}
                      className="flex items-center gap-3 px-3 py-2 text-red-600 dark:text-red-400"
                    >
                      <LogIn className="h-4 w-4 rotate-180" />
                      <span>{tCommon('actions.signOut')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={handleOpenLoginSelector}
                  className="flex items-center gap-2 px-4 py-2 h-9 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-medium"
                >
                  <LogIn className="h-4 w-4" />
                  <span>{tCommon('actions.signIn')}</span>
                </Button>
              )}
            </div>
          </div>
          
          {mounted && (
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label={tCommon('labels.toggleMenu')}
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <MobileMenu
                  navigationLinks={navigationItems}
                  theme={currentTheme || 'light'}
                  toggleTheme={toggleTheme}
                  locale={locale}
                  user={session?.user ? session.user : null}
                  loading={status === 'loading'}
                  handleGoogleSignIn={handleOpenLoginSelector}
                  handleSignOut={handleSignOut}
                  onClose={() => setIsOpen(false)}
                />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </nav>
      {/* Unified login selector (Google, Apple, Crypto) */}
      <UnifiedLoginComponent open={isLoginDialogOpen} onClose={handleCloseLoginDialog} />

      {error && (
        <Alert variant="destructive" className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  )
}

