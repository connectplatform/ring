'use client'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Moon, Sun, X, LogIn, User, Settings, Store, Briefcase, 
  Building2, Wallet, Shield, Crown, Heart, Bell, MessageCircle,
  Home, Info, Phone, FileText, HelpCircle, ChevronRight,
  Sparkles, Zap, Globe
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { LanguageSwitcher } from '@/components/common/language-switcher'
import { signIn } from 'next-auth/react'
import { FcGoogle } from 'react-icons/fc'
import { AiFillApple } from 'react-icons/ai'
import { FaEthereum } from 'react-icons/fa'
import { HiMail } from 'react-icons/hi'

// Import the Session type from next-auth
import { Session } from 'next-auth'
import { UserRole } from '@/features/auth/types'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

/**
 * Props for the MobileMenu component
 */
interface MobileMenuProps {
  navigationLinks: Array<{ href: string; label: string; icon: React.ReactNode; description?: string }>
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
 * Navigation link interface with role-based access
 */
interface NavigationLink {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  requiredRole?: UserRole
  badge?: string
  gradient?: string
}

/**
 * Get user role from session
 */
const getUserRole = (user: Session['user'] | null): UserRole => {
  if (!user) return UserRole.VISITOR
  return (user as any)?.role || UserRole.VISITOR
}

/**
 * Check if user can access a link based on role
 */
const canAccessLink = (link: NavigationLink, userRole: UserRole): boolean => {
  if (!link.requiredRole) return true
  
  const roleHierarchy = {
    [UserRole.VISITOR]: 0,
    [UserRole.SUBSCRIBER]: 1,
    [UserRole.MEMBER]: 2,
    [UserRole.CONFIDENTIAL]: 3,
    [UserRole.ADMIN]: 4
  }
  
  return roleHierarchy[userRole] >= roleHierarchy[link.requiredRole]
}

/**
 * MobileMenu component for responsive navigation
 * 
 * Modern sliding menu with Tailwind 4 gradients, role-based navigation,
 * and integrated authentication options.
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
  const t = useTranslations('navigation')
  const tAuth = useTranslations('modules.auth')
  const [showAuthOptions, setShowAuthOptions] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  
  const userRole = getUserRole(user)
  
  // Use navigation links passed from parent component
  const allNavigationLinks = React.useMemo((): NavigationLink[] => {
    // Main navigation items (from desktop nav)  
    const mainLinks: NavigationLink[] = navigationLinks.map(link => {
      // Extract icon component from React element
      let iconComponent: React.ComponentType<{ className?: string }>
      
      if (typeof link.icon === 'function') {
        iconComponent = link.icon as React.ComponentType<{ className?: string }>
      } else if (React.isValidElement(link.icon) && typeof link.icon.type === 'function') {
        iconComponent = link.icon.type as React.ComponentType<{ className?: string }>
      } else {
        // Fallback to Home icon
        iconComponent = Home
      }
      
      return {
        href: link.href,
        label: link.label,
        icon: iconComponent,
        gradient: 'from-blue-500 to-green-600'
      }
    })

    // Additional user links for authenticated users
    const userLinks: NavigationLink[] = user ? [
      {
        href: ROUTES.PROFILE(locale as 'en' | 'uk'),
        label: t('profile'),
        icon: User,
        gradient: 'from-indigo-500 to-blue-600'
      },
      {
        href: ROUTES.SETTINGS(locale as 'en' | 'uk'),
        label: t('settings'),
        icon: Settings,
        gradient: 'from-gray-500 to-slate-600'
      },
      {
        href: `/${locale}/store/settings`,
        label: 'Store Settings',
        icon: Store,
        gradient: 'from-pink-500 to-rose-600'
      },
      {
        href: ROUTES.MEMBERSHIP(locale as 'en' | 'uk'),
        label: 'Membership',
        icon: Heart,
        gradient: 'from-red-500 to-pink-600'
      }
    ] : []

    // Confidential links for high-tier users
    const confidentialLinks: NavigationLink[] = (userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN) ? [
      {
        href: ROUTES.CONFIDENTIAL_ENTITIES(locale as 'en' | 'uk'),
        label: 'Confidential Entities',
        icon: Shield,
        requiredRole: UserRole.CONFIDENTIAL,
        badge: 'VIP',
        gradient: 'from-purple-500 to-indigo-600'
      },
      {
        href: ROUTES.CONFIDENTIAL_OPPORTUNITIES(locale as 'en' | 'uk'),
        label: 'Confidential Opportunities',
        icon: Crown,
        requiredRole: UserRole.CONFIDENTIAL,
        badge: 'VIP',
        gradient: 'from-amber-500 to-yellow-600'
      }
    ] : []

    return [...mainLinks, ...userLinks, ...confidentialLinks]
  }, [navigationLinks, locale, t, user, userRole])

  // Handle authentication
  const handleAuthAction = useCallback(async (provider: 'google' | 'apple' | 'crypto-wallet') => {
    setIsSigningIn(true)
    try {
      await signIn(provider, { 
        redirect: false,
        callbackUrl: ROUTES.PROFILE(locale as 'en' | 'uk')
      })
    } catch (error) {
      console.error('Sign in error:', error)
    } finally {
      setIsSigningIn(false)
    }
  }, [locale])

  // Animation variants
  const containerVariants = {
    hidden: { x: '-100%', opacity: 0 },
    visible: { 
      x: 0, 
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.05
      }
    },
    exit: { 
      x: '-100%', 
      opacity: 0,
      transition: { duration: 0.2 }
    }
  }

  const itemVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: { x: 0, opacity: 1 }
  }

  const authVariants = {
    hidden: { height: 0, opacity: 0 },
    visible: { 
      height: 'auto', 
      opacity: 1,
      transition: { duration: 0.3 }
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-y-0 left-0 z-50 w-80 bg-gradient-to-br from-background via-background/95 to-background/90 backdrop-blur-xl border-r border-border/50 shadow-2xl"
    >
      {/* Modern gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
      
      <div className="relative h-full flex flex-col p-6">
        {/* Header with logo and close button */}
        <motion.div 
          variants={itemVariants}
          className="flex justify-between items-center mb-8"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Ring
              </h2>
              <p className="text-xs text-muted-foreground">Professional Network</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </Button>
        </motion.div>

        {/* User info section */}
        {user && (
          <motion.div 
            variants={itemVariants}
            className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{user.name || user.email}</p>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground capitalize">{userRole}</span>
                  {userRole === UserRole.CONFIDENTIAL && (
                    <Crown className="w-3 h-3 text-yellow-500" />
                  )}
                  {userRole === UserRole.ADMIN && (
                    <Shield className="w-3 h-3 text-red-500" />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation links */}
        <motion.nav variants={itemVariants} className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {allNavigationLinks.map((link, index) => {
              const IconComponent = link.icon
              
              return (
                <motion.div
                  key={link.href}
                  variants={itemVariants}
                  custom={index}
                >
                  <Link href={link.href} onClick={onClose}>
                    <div className={`group relative p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] bg-gradient-to-r ${link.gradient || 'from-blue-500 to-green-600'} hover:shadow-lg cursor-pointer`}>
                      <div className="absolute inset-0 bg-white/90 dark:bg-black/90 rounded-xl group-hover:bg-white/80 dark:group-hover:bg-black/80 transition-colors" />
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${link.gradient || 'from-blue-500 to-green-600'} text-white`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-sm">{link.label}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {link.badge && (
                            <span className="px-2 py-1 text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full">
                              {link.badge}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </motion.nav>

        {/* Controls section */}
        <motion.div variants={itemVariants} className="mt-6 space-y-4">
          {/* Theme toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-slate-500 to-gray-600 text-white">
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </div>
              <span className="font-medium text-sm">{t('toggleTheme')}</span>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={toggleTheme}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-purple-600"
            />
          </div>

          {/* Language switcher */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                <Globe className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">{t('language')}</span>
            </div>
            <LanguageSwitcher />
          </div>

          <Separator className="my-4" />

          {/* Authentication section */}
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : user ? (
            <Button 
              variant="outline" 
              className="w-full justify-center bg-gradient-to-r from-red-500/10 to-pink-500/10 border-red-500/20 hover:from-red-500/20 hover:to-pink-500/20" 
              onClick={handleSignOut}
            >
              <LogIn className="w-4 h-4 mr-2" />
              {t('signOut')}
            </Button>
          ) : (
            <div className="space-y-3">
              <Button
                variant="ghost"
                className="w-full justify-center text-blue-600 hover:bg-blue-500/10"
                onClick={() => setShowAuthOptions(!showAuthOptions)}
              >
                <LogIn className="w-4 h-4 mr-2" />
                {t('signIn')}
              </Button>
              
              <AnimatePresence>
                {showAuthOptions && (
                  <motion.div
                    variants={authVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className="space-y-2 overflow-hidden"
                  >
                    {/* Magic Link / Email */}
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20 hover:from-green-500/20 hover:to-emerald-500/20"
                      disabled={isSigningIn}
                    >
                      <HiMail className="w-4 h-4 mr-3" />
                      {tAuth('signIn.providers.email')}
                    </Button>

                    {/* Google */}
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/20 hover:from-blue-500/20 hover:to-indigo-500/20"
                      onClick={() => handleAuthAction('google')}
                      disabled={isSigningIn}
                    >
                      <FcGoogle className="w-4 h-4 mr-3" />
                      {tAuth('signIn.providers.google')}
                    </Button>

                    {/* Apple */}
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-gradient-to-r from-gray-500/10 to-slate-500/10 border-gray-500/20 hover:from-gray-500/20 hover:to-slate-500/20"
                      onClick={() => handleAuthAction('apple')}
                      disabled={isSigningIn}
                    >
                      <AiFillApple className="w-4 h-4 mr-3" />
                      {tAuth('signIn.providers.apple')}
                    </Button>

                    {/* MetaMask */}
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/20 hover:from-orange-500/20 hover:to-amber-500/20"
                      onClick={() => handleAuthAction('crypto-wallet')}
                      disabled={isSigningIn}
                    >
                      <FaEthereum className="w-4 h-4 mr-3" />
                      {tAuth('signIn.providers.metamask')}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}

export default MobileMenu

