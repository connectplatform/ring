'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import {
  Briefcase,
  Users,
  User,
  FileText,
  Plus,
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
}

function NavItem({ icon: Icon, label, href, isActive, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 min-w-0 flex-1 transition-all duration-200 ${
        isActive
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className={`h-5 w-5 mb-1 transition-transform duration-200 ${
        isActive ? 'scale-110' : ''
      }`} />
      <span className="text-xs font-medium truncate">{label}</span>
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

export default function BottomNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const { hasRole, user } = useAuth()
  const t = useTranslations('navigation')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showOpportunitySelector, setShowOpportunitySelector] = useState(false)

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
      icon: User,
      label: t('profile'),
      href: ROUTES.PROFILE(locale),
      isActive: isActive(ROUTES.PROFILE(locale))
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
  }

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
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
              onClick={() => handleNavItemClick(item.href)}
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
    </>
  )
}
