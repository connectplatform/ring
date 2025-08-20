'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { Moon, Sun, Menu, User, LogIn, Heart } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import UnifiedLoginComponent from '@/features/auth/components/unified-login-component'
import { NotificationCenter } from '@/features/notifications/components/notification-center'

import { signIn, signOut, useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MiniCart } from '@/features/store/components/mini-cart'
import { FavoritesMenu } from '@/features/store/components/favorites-menu'
import { LanguageSwitcher } from '@/components/common/language-switcher'
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

  const navigationItems = [
    { href: ROUTES.ENTITIES(locale), label: tEntities('title') },
    { href: ROUTES.OPPORTUNITIES(locale), label: tOpp('title') },
    { href: ROUTES.STORE(locale), label: tStore('title') },
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
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
      setError(tCommon('status.error'))
    }
  }, [tCommon])

  // Language switching is now handled by LanguageSwitcher component

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark')
  }, [setTheme, currentTheme])

  return (
    <>
      <nav className={`sticky top-0 z-50 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex justify-between items-center p-4">
          <Link href={ROUTES.HOME(locale)} className="flex items-center gap-4" aria-label={tCommon('labels.homeLink')}>
            <div className="w-12 h-12">
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

          <div className="hidden md:flex items-center space-x-4">
            {mounted ? navigationItems.map(({ href, label }) => (
              <Button key={href} variant="ghost" asChild>
                <Link href={href}>{label}</Link>
              </Button>
            )) : (
              // Show placeholder navigation links during initial render
              <>
                <div className="w-16 h-9 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-20 h-9 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-12 h-9 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-20 h-9 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
              </>
            )}
            {mounted ? (
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={tCommon('labels.toggleTheme')}>
                {currentTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            ) : (
              <div className="w-9 h-9 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
            )}
            {mounted ? (
              <LanguageSwitcher />
            ) : (
              <div className="w-12 h-8 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
            )}
            
            {/* Notification Center - Only show when user is authenticated */}
            {mounted && session && (
              <NotificationCenter />
            )}
            {/* Favorites & MiniCart */}
            <FavoritesMenu locale={locale} />
            <MiniCart locale={locale} />
            
            {!mounted ? (
              // Show placeholder during initial render to prevent hydration mismatch
              <div className="w-24 h-9 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
            ) : status === 'loading' ? (
              <div className="animate-pulse">Loading...</div>
            ) : session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={tCommon('labels.userMenu')}>
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => router.push(ROUTES.PROFILE(locale))}>
                    {tCommon('labels.profile')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleSignOut}>
                    {tCommon('actions.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" onClick={handleOpenLoginSelector}>
                <LogIn className="mr-2 h-4 w-4" />
                {tCommon('actions.signIn')}
              </Button>
            )}
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

