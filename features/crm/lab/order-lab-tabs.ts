import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList,
  Settings2,
  KeyRound,
  FileCode2,
  FolderGit2,
  Rocket,
  MessagesSquare,
  BookOpen,
  LayoutDashboard,
  ListChecks,
} from 'lucide-react'

export type OrderLabRole = 'admin' | 'integrator' | 'buyer'

export type OrderLabTabId =
  | 'overview'
  | 'manage'
  | 'playbook'
  | 'project'
  | 'secrets'
  | 'env'
  | 'source'
  | 'deploy'
  | 'chats'
  | 'wiki'
  | 'room'

export type OrderLabTabStatusKind = 'ok' | 'incomplete' | 'error'

export type OrderLabTabStatus = {
  status: OrderLabTabStatusKind
  missingRequired: string[]
  missingRecommended: string[]
  errors: string[]
  recommendedPending?: number
}

export type OrderLabTabDef = {
  id: OrderLabTabId
  /** i18n key under calculator.order.lab.tabs.* */
  labelKey: string
  icon: LucideIcon
  roles: OrderLabRole[]
}

export const ORDER_LAB_TABS: OrderLabTabDef[] = [
  {
    id: 'overview',
    labelKey: 'overview',
    icon: LayoutDashboard,
    roles: ['admin', 'integrator', 'buyer'],
  },
  {
    id: 'manage',
    labelKey: 'manage',
    icon: ClipboardList,
    roles: ['admin'],
  },
  {
    id: 'playbook',
    labelKey: 'playbook',
    icon: ListChecks,
    roles: ['buyer', 'integrator'],
  },
  {
    id: 'project',
    labelKey: 'project',
    icon: Settings2,
    roles: ['admin', 'integrator', 'buyer'],
  },
  {
    id: 'secrets',
    labelKey: 'secrets',
    icon: KeyRound,
    roles: ['admin', 'integrator', 'buyer'],
  },
  {
    id: 'wiki',
    labelKey: 'wiki',
    icon: BookOpen,
    roles: ['integrator', 'buyer'],
  },
  {
    id: 'env',
    labelKey: 'env',
    icon: FileCode2,
    roles: ['admin', 'integrator'],
  },
  {
    id: 'source',
    labelKey: 'source',
    icon: FolderGit2,
    roles: ['admin', 'integrator', 'buyer'],
  },
  {
    id: 'deploy',
    labelKey: 'deploy',
    icon: Rocket,
    roles: ['admin', 'integrator'],
  },
  {
    id: 'room',
    labelKey: 'room',
    icon: MessagesSquare,
    roles: ['buyer'],
  },
  {
    id: 'chats',
    labelKey: 'chats',
    icon: MessagesSquare,
    roles: ['admin'],
  },
]

export function tabsForRole(role: OrderLabRole): OrderLabTabDef[] {
  return ORDER_LAB_TABS.filter((t) => t.roles.includes(role))
}

export function isOrderLabTabId(value: string | null | undefined): value is OrderLabTabId {
  return ORDER_LAB_TABS.some((t) => t.id === value)
}

export function emptyTabStatus(
  status: OrderLabTabStatusKind = 'ok',
): OrderLabTabStatus {
  return { status, missingRequired: [], missingRecommended: [], errors: [] }
}

/** Pick first error, else first incomplete, else overview.
 * Deep-link hints: `?source=` → source; `#project-config` / `#secrets` → matching tab when available.
 */
export function pickDefaultTab(
  role: OrderLabRole,
  statuses: Partial<Record<OrderLabTabId, OrderLabTabStatus>>,
  hints?: { sourceParam?: string | null; hash?: string | null },
): OrderLabTabId {
  const tabs = tabsForRole(role)
  const ids = new Set(tabs.map((t) => t.id))

  if (hints?.sourceParam && ids.has('source')) return 'source'
  const hash = (hints?.hash || '').replace(/^#/, '')
  if (hash === 'project-config' && ids.has('project')) return 'project'
  if (hash === 'secrets' && ids.has('secrets')) return 'secrets'

  const error = tabs.find((t) => statuses[t.id]?.status === 'error')
  if (error) return error.id
  const incomplete = tabs.find((t) => statuses[t.id]?.status === 'incomplete')
  if (incomplete) return incomplete.id
  return tabs[0]?.id ?? 'overview'
}
