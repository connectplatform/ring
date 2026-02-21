'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { eventBus } from '@/lib/event-bus.client'
import {
  Sprout,
  Tractor,
  ShoppingBasket,
  Plus,
  MoreHorizontal,
  Leaf,
  Wheat,
  Apple,
  Carrot,
  Package,
  Wallet,
  Bell,
  Settings,
  BookOpen,
  HeadphonesIcon,
  TreeDeciduous
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
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
      ? 'text-emerald-600 dark:text-emerald-400'
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
      className="relative flex items-center justify-center w-[68px] h-[68px] bg-transparent hover:bg-emerald-500/10 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 -mt-6"
      aria-label="Add new"
    >
      {/* Animated Logo as Boundary - Now renders at 77x77 pixels */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <AnimatedLogo />
      </div>

      {/* Plus Icon Overlay - Perfectly centered within the animation */}
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <Plus className="h-5 w-5 text-emerald-600 drop-shadow-sm" />
      </div>
    </button>
  )
}

/**
 * GreenFood.live Agricultural Add Menu
 * Shows agricultural-specific creation options
 */
function AgriculturalAddMenu({ isOpen, onClose, locale }: { isOpen: boolean; onClose: () => void; locale: Locale }) {
  const router = useRouter()
  const { hasRole, user } = useAuth()
  const isFarmer = hasRole(UserRole.MEMBER)

  // Listen for modal:close-all event from event bus
  useEffect(() => {
    if (!isOpen) return
    
    const unsubscribe = eventBus.on('modal:close-all', () => {
      onClose()
    })
    
    eventBus.emit('modal:opened', { modalId: 'agricultural-add-menu', zIndex: 9000 })
    
    return () => {
      unsubscribe()
      eventBus.emit('modal:closed', { modalId: 'agricultural-add-menu' })
    }
  }, [isOpen, onClose])

  const addMenuItems = [
    {
      id: 'list-harvest',
      title: locale === 'uk' ? '🌾 Додати врожай' : '🌾 List Harvest',
      description: locale === 'uk' ? 'Виставити ваш врожай на продаж' : 'Put your harvest up for sale',
      icon: Wheat,
      href: `/${locale}/opportunities/add?type=harvest`,
      color: 'from-amber-500 to-orange-500',
      requiresFarmer: true
    },
    {
      id: 'add-product',
      title: locale === 'uk' ? '🥬 Додати продукт' : '🥬 Add Product',
      description: locale === 'uk' ? 'Новий продукт до магазину' : 'New product to your store',
      icon: Apple,
      href: `/${locale}/vendor/products/add`,
      color: 'from-green-500 to-emerald-500',
      requiresFarmer: true
    },
    {
      id: 'create-farm',
      title: locale === 'uk' ? '🚜 Створити ферму' : '🚜 Create Farm',
      description: locale === 'uk' ? 'Зареєструвати вашу ферму' : 'Register your farm profile',
      icon: Tractor,
      href: `/${locale}/entities/add`,
      color: 'from-lime-500 to-green-500',
      requiresFarmer: false
    },
    {
      id: 'request-product',
      title: locale === 'uk' ? '🛒 Запит продукту' : '🛒 Request Product',
      description: locale === 'uk' ? 'Знайти потрібний продукт' : 'Find the product you need',
      icon: ShoppingBasket,
      href: `/${locale}/opportunities/add?type=request`,
      color: 'from-blue-500 to-cyan-500',
      requiresFarmer: false
    },
    {
      id: 'offer-services',
      title: locale === 'uk' ? '🌱 Послуги' : '🌱 Offer Services',
      description: locale === 'uk' ? 'Аграрні послуги' : 'Agricultural services',
      icon: Sprout,
      href: `/${locale}/opportunities/add?type=offer`,
      color: 'from-teal-500 to-emerald-500',
      requiresFarmer: true
    },
    {
      id: 'cooperative',
      title: locale === 'uk' ? '🤝 Кооператив' : '🤝 Join Cooperative',
      description: locale === 'uk' ? "Об'єднатися з фермерами" : 'Unite with other farmers',
      icon: TreeDeciduous,
      href: `/${locale}/opportunities/add?type=cooperative`,
      color: 'from-emerald-600 to-green-700',
      requiresFarmer: false
    }
  ]

  const handleItemClick = (item: typeof addMenuItems[0]) => {
    if (item.requiresFarmer && !isFarmer) {
      // Redirect to membership upgrade
      router.push(`/${locale}/membership`)
    } else {
      router.push(item.href)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[9000] bg-background/95 backdrop-blur-sm md:hidden"
      data-modal="true"
      role="dialog"
      aria-label="Add Menu"
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
        <h2 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
          {locale === 'uk' ? '🌾 Що створити?' : '🌾 What to create?'}
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          {locale === 'uk' ? 'Оберіть дію для вашої ферми' : 'Choose an action for your farm'}
        </p>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          {addMenuItems.map((item) => {
            const Icon = item.icon
            const isLocked = item.requiresFarmer && !isFarmer
            
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`relative p-4 rounded-xl bg-gradient-to-br ${item.color} text-white hover:scale-105 transition-all duration-200 text-left shadow-lg ${
                  isLocked ? 'opacity-75' : ''
                }`}
              >
                {isLocked && (
                  <div className="absolute top-2 right-2 bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded">
                    {locale === 'uk' ? 'ЧЛЕН' : 'MEMBER'}
                  </div>
                )}
                <Icon className="w-6 h-6 mb-2" />
                <div className="font-semibold text-sm mb-1">{item.title}</div>
                <div className="text-xs opacity-90 leading-tight">{item.description}</div>
              </button>
            )
          })}
        </div>

        {/* DAAR Token Info */}
        <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {locale === 'uk' ? 'Заробляйте DAAR токени' : 'Earn DAAR tokens'}
              </p>
              <p className="text-xs text-muted-foreground">
                {locale === 'uk' ? 'За кожен продаж та регенеративні практики' : 'For every sale and regenerative practices'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * GreenFood.live Fullscreen Menu Modal
 * Shows all platform modules as widgets with agricultural descriptions
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
      title: locale === 'uk' ? '🍃 DAAR Гаманець' : '🍃 DAAR Wallet',
      description: locale === 'uk' ? 'Токени, стейкінг, винагороди' : 'Tokens, staking, rewards',
      icon: '🍃',
      href: `/${locale}/wallet`,
      color: 'from-emerald-500 to-green-600'
    },
    {
      id: 'store',
      title: locale === 'uk' ? '🌾 Ринок' : '🌾 Market',
      description: locale === 'uk' ? 'Свіжі продукти від фермерів' : 'Fresh products from farmers',
      icon: '🌾',
      href: `/${locale}/store`,
      color: 'from-amber-500 to-orange-500'
    },
    {
      id: 'entities',
      title: locale === 'uk' ? '🚜 Ферми' : '🚜 Farms',
      description: locale === 'uk' ? 'Перевірені виробники' : 'Verified producers',
      icon: '🚜',
      href: ROUTES.ENTITIES(locale),
      color: 'from-green-600 to-emerald-600'
    },
    {
      id: 'opportunities',
      title: locale === 'uk' ? '🌱 Врожай' : '🌱 Harvest',
      description: locale === 'uk' ? 'Сезонні пропозиції' : 'Seasonal offerings',
      icon: '🌱',
      href: ROUTES.OPPORTUNITIES(locale),
      color: 'from-lime-500 to-green-500'
    },
    {
      id: 'docs',
      title: locale === 'uk' ? '📚 Навчання' : '📚 Learn',
      description: locale === 'uk' ? 'Посібники та документація' : 'Guides and documentation',
      icon: '📚',
      href: ROUTES.DOCS(locale),
      color: 'from-teal-500 to-cyan-500'
    },
    {
      id: 'notifications',
      title: locale === 'uk' ? '🔔 Сповіщення' : '🔔 Notifications',
      description: locale === 'uk' ? 'Оновлення замовлень' : 'Order updates',
      icon: '🔔',
      href: `/${locale}/notifications`,
      color: 'from-yellow-500 to-orange-500'
    },
    {
      id: 'settings',
      title: locale === 'uk' ? '⚙️ Налаштування' : '⚙️ Settings',
      description: locale === 'uk' ? 'Профіль та параметри' : 'Profile and preferences',
      icon: '⚙️',
      href: ROUTES.SETTINGS(locale),
      color: 'from-gray-500 to-slate-500'
    },
    {
      id: 'support',
      title: locale === 'uk' ? '🌻 Підтримка' : '🌻 Support',
      description: locale === 'uk' ? 'Допомога та контакти' : 'Help and contacts',
      icon: '🌻',
      href: `/${locale}/contact`,
      color: 'from-yellow-400 to-amber-500'
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
        <h2 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
          GreenFood.live
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          {locale === 'uk' ? '🌾 Від ферми до столу' : '🌾 Farm to Table'}
        </p>

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
            v1.0.2 • 🇺🇦 Trinity Ukraine
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
  const [showFullscreenMenu, setShowFullscreenMenu] = useState(false)

  // Determine active state based on current path
  const isActive = (href: string) => {
    if (href === `/${locale}`) {
      return pathname === `/${locale}` || pathname === '/'
    }
    return pathname.startsWith(href)
  }

  // Agricultural-themed navigation items
  const navItems = [
    {
      icon: Sprout,
      label: locale === 'uk' ? 'Врожай' : 'Harvest',
      href: ROUTES.OPPORTUNITIES(locale),
      isActive: isActive(ROUTES.OPPORTUNITIES(locale))
    },
    {
      icon: Tractor,
      label: locale === 'uk' ? 'Ферми' : 'Farms',
      href: ROUTES.ENTITIES(locale),
      isActive: isActive(ROUTES.ENTITIES(locale))
    },
    // Center button handled separately
    {
      icon: ShoppingBasket,
      label: locale === 'uk' ? 'Ринок' : 'Market',
      href: `/${locale}/store`,
      isActive: isActive(`/${locale}/store`)
    },
    {
      icon: MoreHorizontal,
      label: locale === 'uk' ? 'Меню' : 'Menu',
      href: '#',
      isActive: false,
      isButton: true,
      onClick: () => setShowFullscreenMenu(true)
    }
  ]

  const handleAddClick = () => {
    setShowAddMenu(true)
  }

  const handleNavItemClick = (href: string) => {
    // Close any open menus
    setShowAddMenu(false)
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

      {/* Agricultural Add Menu Modal */}
      <AgriculturalAddMenu
        isOpen={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        locale={locale}
      />

      {/* Fullscreen Menu Modal */}
      <FullscreenMenuModal
        isOpen={showFullscreenMenu}
        onClose={() => setShowFullscreenMenu(false)}
      />
    </>
  )
}
