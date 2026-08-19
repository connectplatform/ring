/**
 * Closed Lucide map for primary nav icon ids.
 * Packs/clones pick ids; chrome never imports a vertical-named icon.
 * Add generic glyphs here before a pack or overlay references a new id.
 */
import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Building2,
  CircleEllipsis,
  FileText,
  MoreHorizontal,
  Newspaper,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Store,
  Tv,
  UserRound,
  Users,
  Gamepad2,
  Hexagon,
  LayoutGrid,
  Map,
  Wallet,
  Bell,
  Heart,
  ShoppingCart,
  MessageCircle,
  ListTodo,
  Settings,
} from 'lucide-react'

export const PRIMARY_NAV_ICONS = {
  users: Users,
  briefcase: Briefcase,
  store: Store,
  user: UserRound,
  'file-text': FileText,
  ellipsis: CircleEllipsis,
  'more-horizontal': MoreHorizontal,
  'shopping-basket': ShoppingBasket,
  'shopping-bag': ShoppingBag,
  building: Building2,
  newspaper: Newspaper,
  tv: Tv,
  sparkles: Sparkles,
  gamepad: Gamepad2,
  hexagon: Hexagon,
  map: Map,
  'layout-grid': LayoutGrid,
  wallet: Wallet,
  bell: Bell,
  heart: Heart,
  'shopping-cart': ShoppingCart,
  'message-circle': MessageCircle,
  'list-todo': ListTodo,
  settings: Settings,
} as const satisfies Record<string, LucideIcon>

export type PrimaryNavIconId = keyof typeof PRIMARY_NAV_ICONS

export function getPrimaryNavIcon(id: string | undefined): LucideIcon {
  if (id && id in PRIMARY_NAV_ICONS) {
    return PRIMARY_NAV_ICONS[id as PrimaryNavIconId]
  }
  return PRIMARY_NAV_ICONS.users
}
