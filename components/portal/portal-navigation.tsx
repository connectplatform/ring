'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  Home,
  Briefcase,
  Store,
  FileText,
  Users,
  MessageSquare,
  Wallet,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  Zap,
  User,
  LogOut,
  CreditCard,
  Shield,
  BarChart3
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<any>
  badge?: string
  description?: string
}

const navigationItems: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: Home,
    description: 'Portal overview and featured content'
  },
  {
    href: '/opportunities',
    label: 'Opportunities',
    icon: Briefcase,
    badge: '150+',
    description: 'Ring customizations and Web3 opportunities'
  },
  {
    href: '/marketplace',
    label: 'Marketplace',
    icon: Store,
    badge: '50+',
    description: 'Vendor marketplace for Ring services'
  },
  {
    href: '/docs',
    label: 'Documentation',
    icon: FileText,
    badge: '200+',
    description: 'Comprehensive documentation hub'
  },
  {
    href: '/entities',
    label: 'Networking',
    icon: Users,
    badge: '1000+',
    description: 'Professional networking and connections'
  },
  {
    href: '/messages',
    label: 'Messages',
    icon: MessageSquare,
    badge: '3',
    description: 'Real-time messaging and discussions'
  },
  {
    href: '/wallet',
    label: 'Wallet',
    icon: Wallet,
    description: 'Dual-token ecosystem management'
  }
]

interface PortalNavigationProps {
  className?: string
}

export function PortalNavigation({ className }: PortalNavigationProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Mock user data - in real app this would come from auth context
  const user = {
    name: 'John Doe',
    email: 'john@ringplatform.org',
    avatar: '/avatars/john.jpg',
    role: 'MEMBER',
    balance: {
      jwt: 1250.50,
      ring: 250.75
    }
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className={cn(
        "hidden lg:flex fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800",
        className
      )}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Ring Platform
              </span>
            </Link>

            {/* Main Navigation */}
            <div className="flex items-center space-x-1">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "relative flex items-center space-x-2 px-3 py-2",
                        isActive && "bg-blue-600 hover:bg-blue-700"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                          {item.badge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                )
              })}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-3">
              {/* Token Balances */}
              <div className="hidden md:flex items-center space-x-3">
                <div className="flex items-center space-x-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {user.balance.jwt.toFixed(0)} JWT
                  </span>
                </div>
                <div className="flex items-center space-x-1 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-md">
                  <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    {user.balance.ring.toFixed(2)} RING
                  </span>
                </div>
              </div>

              {/* Search */}
              <Button variant="outline" size="sm">
                <Search className="w-4 h-4" />
              </Button>

              {/* Notifications */}
              <Button variant="outline" size="sm" className="relative">
                <Bell className="w-4 h-4" />
                <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs p-0 bg-red-500">
                  3
                </Badge>
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar
                      src={user.avatar}
                      alt={user.name}
                      fallback={user.name.split(' ').map(n => n[0]).join('')}
                      className="h-8 w-8"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                      <Badge variant="outline" className="w-fit mt-1">
                        {user.role}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/wallet" className="flex items-center">
                      <Wallet className="mr-2 h-4 w-4" />
                      <span>Wallet</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/analytics" className="flex items-center">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      <span>Analytics</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Ring
              </span>
            </Link>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="container mx-auto px-4 py-4">
              {/* Token Balances */}
              <div className="flex items-center space-x-2 mb-4">
                <div className="flex items-center space-x-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    {user.balance.jwt.toFixed(0)} JWT
                  </span>
                </div>
                <div className="flex items-center space-x-1 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-md">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                    {user.balance.ring.toFixed(2)} RING
                  </span>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="space-y-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          isActive && "bg-blue-600 hover:bg-blue-700"
                        )}
                      >
                        <Icon className="w-4 h-4 mr-3" />
                        <span>{item.label}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  )
                })}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 mt-4 pt-4">
                <div className="space-y-1">
                  <Button variant="ghost" className="w-full justify-start">
                    <User className="w-4 h-4 mr-3" />
                    Profile
                  </Button>
                  <Button variant="ghost" className="w-full justify-start">
                    <Settings className="w-4 h-4 mr-3" />
                    Settings
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-red-600">
                    <LogOut className="w-4 h-4 mr-3" />
                    Log out
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Spacer for fixed navigation */}
      <div className="h-16 lg:h-16" />
    </>
  )
}

export default PortalNavigation
