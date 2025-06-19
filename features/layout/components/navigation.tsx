'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useTranslation } from '@/node_modules/react-i18next'
import { useTheme } from 'next-themes'
import { Moon, Sun, Menu, User, LogIn } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import LoginDialog from './login-dialog'
import { NotificationCenter } from '@/components/notifications/notification-center'

import { signIn, signOut, useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"

// React 19 Resource Preloading APIs
import { preload, preinit } from 'react-dom'

const AnimatedLogo = dynamic(() => import('@/components/widgets/animated-logo'), {
  ssr: false,
})

const MobileMenu = dynamic(() => import('./mobile-menu'), {
  ssr: false,
})

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

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
  const { t, i18n } = useTranslation()
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
    
    // Preload navigation icons and assets
    preload('/icons/moon.svg', { as: 'image' })
    preload('/icons/sun.svg', { as: 'image' })
    preload('/icons/menu.svg', { as: 'image' })
    preload('/icons/user.svg', { as: 'image' })
    preload('/icons/login.svg', { as: 'image' })
    
    // Preload logo assets
    preload('/images/logo.svg', { as: 'image' })
    preload('/images/logo-animated.svg', { as: 'image' })
    preload('/images/logo-dark.svg', { as: 'image' })
    
    // Preload navigation destination resources
    preload('/api/entities', { as: 'fetch' })
    preload('/api/opportunities', { as: 'fetch' })
    preload('/api/profile', { as: 'fetch' })
    
    // Preload common page assets for faster navigation
    preload('/images/entities-hero.webp', { as: 'image' })
    preload('/images/opportunities-hero.webp', { as: 'image' })
    preload('/images/about-hero.webp', { as: 'image' })
    
    // Preinit navigation-related scripts
    preinit('/scripts/navigation-analytics.js', { as: 'script' })
    preinit('/scripts/theme-persistence.js', { as: 'script' })
    
    // Preload authentication-related resources
    if (!session) {
      preload('/api/auth/providers', { as: 'fetch' })
      preload('/images/auth-background.webp', { as: 'image' })
    }
    
    // Preload user-specific resources if authenticated
    if (session?.user) {
      preload(`/api/users/${session.user.id}`, { as: 'fetch' })
      preload('/api/notifications', { as: 'fetch' })
      if (session.user.image) {
        preload(session.user.image, { as: 'image' })
      }
    }
  }, [session])

  const navigationItems = [
    { href: ROUTES.ENTITIES(DEFAULT_LOCALE), label: t('entities') },
    { href: ROUTES.OPPORTUNITIES(DEFAULT_LOCALE), label: t('opportunities') },
    { href: ROUTES.ABOUT(DEFAULT_LOCALE), label: t('about') },
    { href: ROUTES.PRIVACY(DEFAULT_LOCALE), label: t('privacyPolicy') },
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

  const handleGoogleSignIn = useCallback(async () => {
    setIsOpen(false)
    try {
      await signIn('google')
    } catch (error) {
      console.error('Error signing in with Google:', error)
      setError(t('signInError'))
    }
  }, [t])

  const handleSignOut = useCallback(async () => {
    setIsOpen(false)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
      setError(t('signOutError'))
    }
  }, [t])

  const toggleLanguage = useCallback(() => {
    const newLang = i18n.language === 'en' ? 'uk' : 'en'
    i18n.changeLanguage(newLang)
  }, [i18n])

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark')
  }, [setTheme, currentTheme])

  return (
    <>
      <nav className={`sticky top-0 z-50 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex justify-between items-center p-4">
          <Link href={ROUTES.HOME(DEFAULT_LOCALE)} className="flex items-center gap-4" aria-label={t('homeLink')}>
            <div className="w-12 h-12">
              <AnimatedLogo />
            </div>
            <span className="font-bold text-xl">
              <span className="text-blue-500 dark:text-blue-400">Techno</span>
              <span className="text-green-500 dark:text-green-400">Ring</span>
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
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('toggleTheme')}>
                {currentTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            ) : (
              <div className="w-9 h-9 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
            )}
            {mounted ? (
              <Button variant="ghost" size="sm" onClick={toggleLanguage} className="h-8 px-2">
                {i18n.language === 'en' ? 'EN' : 'UK'}
                <span className="sr-only">{t('toggleLanguage')}</span>
              </Button>
            ) : (
              <div className="w-12 h-8 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
            )}
            
            {/* Notification Center - Only show when user is authenticated */}
            {mounted && session && (
              <NotificationCenter />
            )}
            
            {!mounted ? (
              // Show placeholder during initial render to prevent hydration mismatch
              <div className="w-24 h-9 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
            ) : status === 'loading' ? (
              <div className="animate-pulse">Loading...</div>
            ) : session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t('userMenu')}>
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => router.push(ROUTES.PROFILE(DEFAULT_LOCALE))}>
                    {t('profile')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleSignOut}>
                    {t('signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" onClick={handleGoogleSignIn}>
                <LogIn className="mr-2 h-4 w-4" />
                {t('signIn')}
              </Button>
            )}
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t('openMenu')}
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <MobileMenu
                navigationLinks={navigationItems}
                theme={currentTheme || 'light'}
                toggleTheme={toggleTheme}
                toggleLanguage={toggleLanguage}
                user={mounted && session?.user ? session.user : null}
                loading={!mounted || status === 'loading'}
                handleGoogleSignIn={handleGoogleSignIn}
                handleSignOut={handleSignOut}
                onClose={() => setIsOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      <LoginDialog open={isLoginDialogOpen} onCloseAction={handleCloseLoginDialog} />

      {error && (
        <Alert variant="destructive" className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  )
}

