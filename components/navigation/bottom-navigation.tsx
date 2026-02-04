'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { eventBus } from '@/lib/event-bus.client'
import {
  Briefcase,
  Users,
  User,
  FileText,
  Plus,
  MoreHorizontal,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { OpportunityTypeSelector } from '@/components/opportunities/opportunity-type-selector'
import { useAuth } from '@/hooks/use-auth'
import { UserRole } from '@/features/auth/types'
import type { Locale } from '@/i18n-config'

const AnimatedLogo = dynamic(() => import('@/components/common/widgets/animated-logo'), {
  ssr: false,
})

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href: string
  isActive: boolean
  onClick?: () => void
  isButton?: boolean
}

function NavItem({ icon: Icon, label, href, isActive, onClick, isButton }: NavItemProps) {
  const className = `flex flex-col items-center justify-center p-2 min-w-0 flex-1 transition-all duration-200 ${
    isActive
      ? 'text-primary'
      : 'text-muted-foreground hover:text-foreground'
  }`

  const content = (
    <>
      <Icon className={`h-5 w-5 mb-1 transition-transform duration-200 ${
        isActive ? 'scale-110' : ''
      }`} />
      <span className="text-xs font-medium truncate">{label}</span>
    </>
  )

  if (isButton && onClick) {
    return (
      <button onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return (
    <Link href={href} onClick={onClick} className={className}>
      {content}
    </Link>
  )
}

interface CenterAddButtonProps {
  onClick: () => void
}

function CenterAddButton({ onClick }: CenterAddButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center w-[68px] h-[68px] bg-transparent hover:bg-primary/10 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 -mt-6"
      aria-label="Add new"
    >
      {/* Animated Logo as Boundary - Now renders at 77x77 pixels */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <AnimatedLogo />
      </div>

      {/* Plus Icon Overlay - Perfectly centered within the animation */}
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <Plus className="h-5 w-5 text-primary drop-shadow-sm" />
      </div>
    </button>
  )
}

/**
 * Fullscreen Menu Modal Component
 * Shows all Ring platform modules as widgets with descriptions
 * Listens to event bus for modal:close-all events
 */
function FullscreenMenuModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter()
  const locale = useLocale() as Locale
  const t = useTranslations('navigation')

  // Listen for modal:close-all event from event bus
  useEffect(() => {
    if (!isOpen) return
    
    const unsubscribe = eventBus.on('modal:close-all', () => {
      onClose()
    })
    
    // Emit modal opened event
    eventBus.emit('modal:opened', { modalId: 'fullscreen-menu', zIndex: 9000 })
    
    return () => {
      unsubscribe()
      eventBus.emit('modal:closed', { modalId: 'fullscreen-menu' })
    }
  }, [isOpen, onClose])

  const menuItems = [
    {
      id: 'wallet',
      title: t('wallet'),
      description: t('menu.wallet.description'),
      icon: '💰',
      href: `/${locale}/wallet`,
      color: 'from-green-500 to-blue-500'
    },
    {
      id: 'store',
      title: t('store'),
      description: t('menu.store.description'),
      icon: '🛍️',
      href: `/${locale}/store`,
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'entities',
      title: t('entities'),
      description: t('menu.entities.description'),
      icon: '🏢',
      href: ROUTES.ENTITIES(locale),
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'opportunities',
      title: t('opportunities'),
      description: t('menu.opportunities.description'),
      icon: '💼',
      href: ROUTES.OPPORTUNITIES(locale),
      color: 'from-orange-500 to-red-500'
    },
    {
      id: 'docs',
      title: t('docs'),
      description: t('menu.docs.description'),
      icon: '📚',
      href: ROUTES.DOCS(locale),
      color: 'from-cyan-500 to-teal-500'
    },
    {
      id: 'notifications',
      title: t('notifications'),
      description: t('menu.notifications.description'),
      icon: '🔔',
      href: `/${locale}/notifications`,
      color: 'from-yellow-500 to-orange-500'
    },
    {
      id: 'settings',
      title: t('settings'),
      description: t('menu.settings.description'),
      icon: '⚙️',
      href: ROUTES.SETTINGS(locale),
      color: 'from-gray-500 to-slate-500'
    },
    {
      id: 'support',
      title: t('support'),
      description: t('menu.support.description'),
      icon: '🆘',
      href: `/${locale}/support`,
      color: 'from-red-500 to-pink-500'
    }
  ]

  const handleItemClick = (href: string) => {
    router.push(href)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[9000] bg-background/95 backdrop-blur-sm md:hidden"
      data-modal="true"
      role="dialog"
      aria-label="Navigation Menu"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors text-lg"
        aria-label="Close menu"
      >
        ✕
      </button>

      {/* Header */}
      <div className="pt-20 px-6 pb-6">
        <h2 className="text-2xl font-bold text-center mb-8">{t('menu.title')}</h2>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.href)}
              className={`p-4 rounded-xl bg-gradient-to-br ${item.color} text-white hover:scale-105 transition-all duration-200 text-left shadow-lg`}
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-semibold text-sm mb-1">{item.title}</div>
              <div className="text-xs opacity-90 leading-tight">{item.description}</div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t('menu.version', { version: '1.45' })}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function BottomNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const { hasRole, user } = useAuth()
  const t = useTranslations('navigation')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showOpportunitySelector, setShowOpportunitySelector] = useState(false)
  const [showFullscreenMenu, setShowFullscreenMenu] = useState(false)

  // Determine active state based on current path
  const isActive = (href: string) => {
    if (href === `/${locale}`) {
      return pathname === `/${locale}` || pathname === '/'
    }
    return pathname.startsWith(href)
  }

  // Navigation items configuration
  const navItems = [
    {
      icon: Briefcase,
      label: t('opportunities'),
      href: ROUTES.OPPORTUNITIES(locale),
      isActive: isActive(ROUTES.OPPORTUNITIES(locale))
    },
    {
      icon: Users,
      label: t('entities'),
      href: ROUTES.ENTITIES(locale),
      isActive: isActive(ROUTES.ENTITIES(locale))
    },
    // Center button handled separately
    {
      icon: FileText,
      label: t('docs'),
      href: ROUTES.DOCS(locale),
      isActive: isActive(ROUTES.DOCS(locale))
    },
    {
      icon: MoreHorizontal,
      label: 'Menu',
      href: '#',
      isActive: false,
      isButton: true,
      onClick: () => setShowFullscreenMenu(true)
    }
  ]

  const handleAddClick = () => {
    setShowAddMenu(true)
    // Show opportunity type selector modal
    setShowOpportunitySelector(true)
  }

  const handleNavItemClick = (href: string) => {
    // Close any open menus
    setShowAddMenu(false)
    setShowOpportunitySelector(false)
    setShowFullscreenMenu(false)
  }

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[9000] md:hidden">
        <div className="flex items-end justify-around bg-white/10 dark:bg-black/10 backdrop-blur-md border-t border-border px-2 py-1">
          {/* Left Items */}
          {navItems.slice(0, 2).map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={item.isActive}
              onClick={() => handleNavItemClick(item.href)}
            />
          ))}

          {/* Center Add Button */}
          <div className="flex-1 flex justify-center">
            <CenterAddButton onClick={handleAddClick} />
          </div>

          {/* Right Items */}
          {navItems.slice(2).map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={item.isActive}
              isButton={item.isButton}
              onClick={item.isButton ? item.onClick : () => handleNavItemClick(item.href)}
            />
          ))}
        </div>

        {/* Safe area padding for devices with home indicators */}
        <div className="h-safe-area-inset-bottom bg-background/95" />
      </nav>

      {/* Opportunity Type Selector Modal */}
      {showOpportunitySelector && (
        <OpportunityTypeSelector
          onClose={() => {
            setShowOpportunitySelector(false)
            setShowAddMenu(false)
          }}
          userRole={hasRole(UserRole.MEMBER) ? 'member' : 'subscriber'}
          locale={locale}
        />
      )}

      {/* Fullscreen Menu Modal */}
      <FullscreenMenuModal
        isOpen={showFullscreenMenu}
        onClose={() => setShowFullscreenMenu(false)}
      />
    </>
  )
}
