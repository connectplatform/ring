'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Moon, Sun, X, LogIn, Globe, User } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { LanguageSwitcher } from '@/components/common/language-switcher'

// Import the Session type from next-auth
import { Session } from 'next-auth'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

/**
 * Props for the MobileMenu component
 * @typedef {Object} MobileMenuProps
 * @property {Array<{href: string, label: string}>} navigationLinks - Array of navigation link objects
 * @property {string} theme - Current theme ('light' or 'dark')
 * @property {() => void} toggleTheme - Function to toggle the theme
 * @property {() => void} toggleLanguage - Function to toggle the language
 * @property {Session['user'] | null} user - User object from the session, or null if not authenticated
 * @property {boolean} loading - Whether the authentication state is loading
 * @property {() => void} handleGoogleSignIn - Function to handle Google sign-in
 * @property {() => void} handleSignOut - Function to handle sign-out
 * @property {() => void} onClose - Function to close the mobile menu
 */
interface MobileMenuProps {
  navigationLinks: Array<{ href: string; label: string }>
  theme: string
  toggleTheme: () => void
  locale: string
  user: Session['user'] | null
  loading: boolean
  handleGoogleSignIn: () => void
  handleSignOut: () => void
  onClose: () => void
}

/**
 * MobileMenu component for responsive navigation
 * 
 * This component renders a mobile-friendly menu with navigation links,
 * theme toggle, language toggle, and authentication actions.
 * 
 * User steps:
 * 1. User opens the mobile menu (typically by clicking a hamburger icon)
 * 2. User can navigate through the app using the provided links
 * 3. User can toggle between light and dark themes
 * 4. User can switch between available languages
 * 5. User can sign in or access their profile if already signed in
 * 6. User can sign out if they're currently authenticated
 * 7. User can close the mobile menu by clicking the close button
 * 
 * @param {MobileMenuProps} props - The props for the MobileMenu component
 * @returns {React.ReactElement} The rendered MobileMenu component
 */
const MobileMenu: React.FC<MobileMenuProps> = ({
  navigationLinks,
  theme,
  toggleTheme,
  locale,
  user,
  loading,
  handleGoogleSignIn,
  handleSignOut,
  onClose,
}) => {
  const t = useTranslations('Navigation')

  return (
    <Card className="p-4 h-full w-full max-w-sm bg-background text-foreground">
      {/* Header with logo and close button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">
          <span className="text-blue-500 dark:text-blue-400">Techno</span>
          <span className="text-green-500 dark:text-green-400">Ring</span>
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('closeMenu')}>
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Navigation links */}
      <nav>
        <ul className="space-y-2">
          {navigationLinks.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} passHref legacyBehavior>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={onClose}
                >
                  {label}
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Separator className="my-4" />

      {/* Theme toggle, language toggle, and authentication actions */}
      <div className="space-y-4">
        {/* Theme toggle */}
        <div className="flex items-center justify-between">
          <span>{t('toggleTheme')}</span>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={toggleTheme}
            aria-label={t('toggleTheme')}
          >
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Switch>
        </div>

        {/* Language toggle */}
        <div className="w-full flex justify-center">
          <LanguageSwitcher />
        </div>

        {/* Authentication actions */}
        {loading ? (
          <p>{t('loading')}</p>
        ) : user ? (
          <>
            {/* User profile link when authenticated */}
            <Link href={ROUTES.PROFILE(locale as 'en' | 'uk')} passHref legacyBehavior>
              <Button variant="outline" className="w-full justify-between" onClick={onClose}>
                <span>{t('profile')}</span>
                <User className="h-5 w-5" />
              </Button>
            </Link>
            {/* Sign out button when authenticated */}
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              {t('logout')}
            </Button>
          </>
        ) : (
          // Sign in button when not authenticated
          <Button variant="outline" className="w-full justify-between" onClick={handleGoogleSignIn}>
            <span>{t('signIn')}</span>
            <LogIn className="h-5 w-5" />
          </Button>
        )}
      </div>
    </Card>
  )
}

export default MobileMenu

