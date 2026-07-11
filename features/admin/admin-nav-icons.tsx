/**
 * Shared icon map — must stay free of 'use client' so server modules
 * (admin-dashboard-tiles) can resolve icon components during SSR.
 */
import type { ComponentType } from 'react'
import {
  Activity,
  Archive,
  BarChart3,
  Coins,
  CreditCard,
  Database,
  FileText,
  ListTodo,
  Mail,
  Package,
  Plus,
  Settings,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Tags,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import type { AdminNavIconKey } from '@/features/admin/admin-nav-config'

const ICON_MAP: Record<AdminNavIconKey, ComponentType<{ className?: string }>> = {
  BarChart3,
  Users,
  FileText,
  Coins,
  Shield,
  TrendingUp,
  ShieldAlert,
  Database,
  Settings,
  Activity,
  Archive,
  CreditCard,
  Mail,
  ListTodo,
  Zap,
  Tags,
  Plus,
  Package,
  ShoppingBag,
  Wallet,
}

export function getAdminNavIconComponent(name: AdminNavIconKey): ComponentType<{ className?: string }> {
  return ICON_MAP[name]
}

export function AdminNavIcon({
  name,
  className = 'h-4 w-4',
}: {
  name: AdminNavIconKey
  className?: string
}) {
  const Icon = ICON_MAP[name]
  return <Icon className={className} />
}
