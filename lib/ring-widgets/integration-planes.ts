import type { Locale } from '@/i18n/shared'
import { completeLocaleRecord } from '@/lib/locale-config'

export type IntegrationPlanesTheme = 'light' | 'dark' | 'inherit'

export type IntegrationPlaneId =
  | 'identity'
  | 'payments'
  | 'comms'
  | 'mail'
  | 'external'

export type IntegrationNode = {
  id: string
  label: string
  href: string
}

export type IntegrationPlane = {
  id: IntegrationPlaneId
  title: string
  href: string
  nodes: IntegrationNode[]
}

export type IntegrationHubCopy = {
  title: string
  subtitle: string
  centerLabel: string
  centerSublabel: string
  centerHref: string
  tapHint: string
  planes: IntegrationPlane[]
}

const planesEn: IntegrationPlane[] = [
  {
    id: 'identity',
    title: 'Identity & wallets',
    href: '/docs/features/authentication',
    nodes: [
      { id: 'oauth', label: 'Google · Apple · GitHub · Discord', href: '/docs/features/authentication' },
      { id: 'magic', label: 'Ring Mailer OTP / magic links', href: '/docs/features/authentication' },
      { id: 'evm', label: 'Wagmi v3 · WalletConnect', href: '/docs/integrations/ethereum-wallets' },
    ],
  },
  {
    id: 'payments',
    title: 'Payments & credits',
    href: '/docs/customization/payment-integration',
    nodes: [
      { id: 'pc', label: 'PaymentConductor', href: '/docs/features/payment-conductor' },
      { id: 'wfp', label: 'WayForPay', href: '/docs/features/wayforpay-integration' },
      { id: 'stripe', label: 'Stripe', href: '/docs/customization/payment-integration' },
      { id: 'credit', label: 'RING credits ledger', href: '/docs/features/wallet' },
    ],
  },
  {
    id: 'comms',
    title: 'Notifications & realtime',
    href: '/docs/features/push-notifications-fcm',
    nodes: [
      { id: 'fcm', label: 'Firebase FCM push', href: '/docs/features/push-notifications-fcm' },
      { id: 'tunnel', label: 'Tunnel SSE / WS / poll', href: '/docs/features/tunnel-protocol' },
    ],
  },
  {
    id: 'mail',
    title: 'Email AI-CRM',
    href: '/docs/features/email-ai-crm',
    nodes: [
      { id: 'imap', label: 'IMAP ingest', href: '/docs/features/email-ai-crm' },
      { id: 'smtp', label: 'SMTP outbound', href: '/docs/features/email-ai-crm' },
      { id: 'mailer', label: 'Ring Mailer auth', href: '/docs/features/ring-mailer' },
    ],
  },
  {
    id: 'external',
    title: 'External automation',
    href: '/docs/examples/api-integration',
    nodes: [
      { id: 'rest', label: 'REST /api/*', href: '/docs/api' },
      { id: 'mcp', label: '/api/mcp/v1/*', href: '/docs/mcp' },
    ],
  },
]

const copy = completeLocaleRecord<IntegrationHubCopy>({
  en: {
    title: 'Integration planes on a Ring clone',
    subtitle: 'Tap any plane or connector — each link opens the canonical operator doc.',
    centerLabel: 'Next.js',
    centerSublabel: 'PostgreSQL',
    centerHref: '/docs/deployment/environment',
    tapHint: 'Tap to open docs',
    planes: planesEn,
  },
  uk: {
    title: 'Площини інтеграції на клоні Ring',
    subtitle: 'Торкніться площини або конектора — відкриється операторська документація.',
    centerLabel: 'Next.js',
    centerSublabel: 'PostgreSQL',
    centerHref: '/docs/deployment/environment',
    tapHint: 'Торкніться для документації',
    planes: [
      {
        id: 'identity',
        title: 'Ідентичність і гаманці',
        href: '/docs/features/authentication',
        nodes: [
          { id: 'oauth', label: 'Google · Apple · GitHub · Discord', href: '/docs/features/authentication' },
          { id: 'magic', label: 'Ring Mailer OTP / magic links', href: '/docs/features/authentication' },
          { id: 'evm', label: 'Wagmi v3 · WalletConnect', href: '/docs/integrations/ethereum-wallets' },
        ],
      },
      {
        id: 'payments',
        title: 'Платежі та кредити',
        href: '/docs/customization/payment-integration',
        nodes: [
          { id: 'pc', label: 'PaymentConductor', href: '/docs/features/payment-conductor' },
          { id: 'wfp', label: 'WayForPay', href: '/docs/features/wayforpay-integration' },
          { id: 'stripe', label: 'Stripe', href: '/docs/customization/payment-integration' },
          { id: 'credit', label: 'RING credits ledger', href: '/docs/features/wallet' },
        ],
      },
      {
        id: 'comms',
        title: 'Сповіщення та realtime',
        href: '/docs/features/push-notifications-fcm',
        nodes: [
          { id: 'fcm', label: 'Firebase FCM push', href: '/docs/features/push-notifications-fcm' },
          { id: 'tunnel', label: 'Tunnel SSE / WS / poll', href: '/docs/features/tunnel-protocol' },
        ],
      },
      {
        id: 'mail',
        title: 'Email AI-CRM',
        href: '/docs/features/email-ai-crm',
        nodes: [
          { id: 'imap', label: 'IMAP ingest', href: '/docs/features/email-ai-crm' },
          { id: 'smtp', label: 'SMTP outbound', href: '/docs/features/email-ai-crm' },
          { id: 'mailer', label: 'Ring Mailer auth', href: '/docs/features/ring-mailer' },
        ],
      },
      {
        id: 'external',
        title: 'Зовнішня автоматизація',
        href: '/docs/examples/api-integration',
        nodes: [
          { id: 'rest', label: 'REST /api/*', href: '/docs/api' },
          { id: 'mcp', label: '/api/mcp/v1/*', href: '/docs/mcp' },
        ],
      },
    ],
  },
  ru: {
    title: 'Плоскости интеграции на клоне Ring',
    subtitle: 'Нажмите на плоскость или коннектор — откроется операторская документация.',
    centerLabel: 'Next.js',
    centerSublabel: 'PostgreSQL',
    centerHref: '/docs/deployment/environment',
    tapHint: 'Нажмите для документации',
    planes: [
      {
        id: 'identity',
        title: 'Идентичность и кошельки',
        href: '/docs/features/authentication',
        nodes: [
          { id: 'oauth', label: 'Google · Apple · GitHub · Discord', href: '/docs/features/authentication' },
          { id: 'magic', label: 'Ring Mailer OTP / magic links', href: '/docs/features/authentication' },
          { id: 'evm', label: 'Wagmi v3 · WalletConnect', href: '/docs/integrations/ethereum-wallets' },
        ],
      },
      {
        id: 'payments',
        title: 'Платежи и кредиты',
        href: '/docs/customization/payment-integration',
        nodes: [
          { id: 'pc', label: 'PaymentConductor', href: '/docs/features/payment-conductor' },
          { id: 'wfp', label: 'WayForPay', href: '/docs/features/wayforpay-integration' },
          { id: 'stripe', label: 'Stripe', href: '/docs/customization/payment-integration' },
          { id: 'credit', label: 'RING credits ledger', href: '/docs/features/wallet' },
        ],
      },
      {
        id: 'comms',
        title: 'Уведомления и realtime',
        href: '/docs/features/push-notifications-fcm',
        nodes: [
          { id: 'fcm', label: 'Firebase FCM push', href: '/docs/features/push-notifications-fcm' },
          { id: 'tunnel', label: 'Tunnel SSE / WS / poll', href: '/docs/features/tunnel-protocol' },
        ],
      },
      {
        id: 'mail',
        title: 'Email AI-CRM',
        href: '/docs/features/email-ai-crm',
        nodes: [
          { id: 'imap', label: 'IMAP ingest', href: '/docs/features/email-ai-crm' },
          { id: 'smtp', label: 'SMTP outbound', href: '/docs/features/email-ai-crm' },
          { id: 'mailer', label: 'Ring Mailer auth', href: '/docs/features/ring-mailer' },
        ],
      },
      {
        id: 'external',
        title: 'Внешняя автоматизация',
        href: '/docs/examples/api-integration',
        nodes: [
          { id: 'rest', label: 'REST /api/*', href: '/docs/api' },
          { id: 'mcp', label: '/api/mcp/v1/*', href: '/docs/mcp' },
        ],
      },
    ],
  },
})

export function getIntegrationHubCopy(locale: Locale = 'en'): IntegrationHubCopy {
  return copy[locale] ?? copy.en
}

export const planeTone: Record<
  IntegrationPlaneId,
  { ring: string; bg: string; icon: string; beam: string }
> = {
  identity: {
    ring: 'ring-violet-500/35',
    bg: 'bg-violet-500/10',
    icon: 'text-violet-600 dark:text-violet-400',
    beam: 'from-violet-500/50',
  },
  payments: {
    ring: 'ring-emerald-500/35',
    bg: 'bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
    beam: 'from-emerald-500/50',
  },
  comms: {
    ring: 'ring-sky-500/35',
    bg: 'bg-sky-500/10',
    icon: 'text-sky-600 dark:text-sky-400',
    beam: 'from-sky-500/50',
  },
  mail: {
    ring: 'ring-amber-500/35',
    bg: 'bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
    beam: 'from-amber-500/50',
  },
  external: {
    ring: 'ring-fuchsia-500/35',
    bg: 'bg-fuchsia-500/10',
    icon: 'text-fuchsia-600 dark:text-fuchsia-400',
    beam: 'from-fuchsia-500/50',
  },
}
