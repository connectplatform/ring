import type { Locale } from '@/i18n/shared'

export type WelcomeFeatureTheme = 'light' | 'dark' | 'inherit'

export type WelcomeFeatureItem = {
  id: string
  emoji: string
  title: string
  description: string
  href: string
}

export type WelcomeFeatureSection = {
  label: string
  items: WelcomeFeatureItem[]
}

export type WelcomeFeatureExplorerCopy = {
  title: string
  subtitle: string
  tabProductOwner: string
  tabDeveloper: string
  openDoc: string
  productOwner: WelcomeFeatureSection[]
  developer: WelcomeFeatureSection[]
}

const productOwnerEn: WelcomeFeatureSection[] = [
  {
    label: 'Core',
    items: [
      {
        id: 'opportunities',
        emoji: '🎯',
        title: 'AI Opportunity Matching',
        description: '8-factor matcher — opportunities find people via intelligent DMs.',
        href: '/docs/features/opportunities',
      },
      {
        id: 'entities',
        emoji: '🏢',
        title: 'Organizations & Entities',
        description: '26 industry categories, verification, and directory profiles.',
        href: '/docs/features/entities',
      },
      {
        id: 'messaging',
        emoji: '💬',
        title: 'Real-time Messaging',
        description: 'Tunnel-backed chat tied to opportunities and deals.',
        href: '/docs/features/messaging',
      },
      {
        id: 'notifications',
        emoji: '🔔',
        title: 'Smart Notifications',
        description: 'In-app inbox, unread counts, and matcher alerts.',
        href: '/docs/features/notifications',
      },
    ],
  },
  {
    label: 'Business',
    items: [
      {
        id: 'store',
        emoji: '🏪',
        title: 'Multi-vendor Store',
        description: 'Vendor onboarding, commissions, cart, and checkout.',
        href: '/docs/features/store',
      },
      {
        id: 'wallet',
        emoji: '💰',
        title: 'Wallet & Payments',
        description: 'RING credits, top-up, membership spend, and fiat rails.',
        href: '/docs/features/wallet',
      },
      {
        id: 'nft-market',
        emoji: '🎨',
        title: 'NFT Marketplace',
        description: 'White-label NFT listings and storefront modules.',
        href: '/docs/features/nft-market',
      },
      {
        id: 'staking',
        emoji: '💎',
        title: 'Token Staking',
        description: 'DeFi staking pools and governance weight patterns.',
        href: '/docs/features/staking',
      },
      {
        id: 'payments',
        emoji: '💳',
        title: 'Payments & WayForPay',
        description: 'PaymentConductor checkout for store and membership.',
        href: '/docs/features/payments',
      },
      {
        id: 'affiliate',
        emoji: '🤝',
        title: 'Affiliate Enablement',
        description: 'Dual-rail ERP commissions and platform token rewards.',
        href: '/docs/features/affiliate-enablement',
      },
    ],
  },
  {
    label: 'Content & community',
    items: [
      {
        id: 'news',
        emoji: '📰',
        title: 'News Kingdom',
        description: 'Editorial workflows, generative newsroom, and promotion.',
        href: '/docs/features/news',
      },
      {
        id: 'member-blog',
        emoji: '✍️',
        title: 'Member Blog',
        description: 'Member-authored posts with moderation and discovery.',
        href: '/docs/features/member-blog',
      },
      {
        id: 'scientific-editor',
        emoji: '🔬',
        title: 'Scientific Editor',
        description: 'Live agent chat for publication editing workflows.',
        href: '/docs/features/scientific-editor',
      },
      {
        id: 'email-crm',
        emoji: '📧',
        title: 'Email AI-CRM',
        description: 'Public inbox ingest, AI drafts, and admin approve/send.',
        href: '/docs/features/email-ai-crm',
      },
      {
        id: 'erp',
        emoji: '🏭',
        title: 'ERP & Cooperatives',
        description: 'FSMA traceability, vendor ops, and cooperative governance.',
        href: '/docs/features/erp',
      },
      {
        id: 'mobile',
        emoji: '📱',
        title: 'Mobile Experience',
        description: 'PWA patterns, responsive nav, and push-ready UX.',
        href: '/docs/features/mobile-experience',
      },
    ],
  },
]

const developerEn: WelcomeFeatureSection[] = [
  {
    label: 'Architecture',
    items: [
      {
        id: 'architecture',
        emoji: '🏗️',
        title: 'Architecture Overview',
        description: 'System layout, BackendSelector, and data flow.',
        href: '/docs/architecture',
      },
      {
        id: 'data-model',
        emoji: '📊',
        title: 'Database Architecture',
        description: 'PostgreSQL schema v4, JSONB collections, PostGIS.',
        href: '/docs/architecture/data-model',
      },
      {
        id: 'backend-modes',
        emoji: '🗄️',
        title: 'Backend Modes',
        description: 'k8s-postgres-fcm vs supabase-fcm vs firebase-full.',
        href: '/docs/architecture/backend-modes-and-databases',
      },
      {
        id: 'real-time',
        emoji: '⚡',
        title: 'Real-time Transport',
        description: 'WebSocket, SSE, and long-poll fallback chain.',
        href: '/docs/architecture/real-time',
      },
    ],
  },
  {
    label: 'Platform features',
    items: [
      {
        id: 'authentication',
        emoji: '🔐',
        title: 'Authentication System',
        description: 'Auth.js v5, OAuth, magic links, wallet sign-in.',
        href: '/docs/features/authentication',
      },
      {
        id: 'tunnel',
        emoji: '📡',
        title: 'Tunnel Protocol',
        description: 'TunnelHub broker, publish API, and React hooks.',
        href: '/docs/features/tunnel-protocol',
      },
      {
        id: 'payment-conductor',
        emoji: '🎛️',
        title: 'PaymentConductor',
        description: 'Ledger, webhooks, idempotent order references.',
        href: '/docs/features/payment-conductor',
      },
      {
        id: 'video-conductor',
        emoji: '🎬',
        title: 'VideoConductor',
        description: 'Generative video pipeline — draft 480p to production 720p.',
        href: '/docs/features/video-conductor',
      },
      {
        id: 'fcm',
        emoji: '📲',
        title: 'Push Notifications (FCM)',
        description: 'Token registry, service worker, stale-token cleanup.',
        href: '/docs/features/push-notifications-fcm',
      },
      {
        id: 'locale',
        emoji: '🌍',
        title: 'Locale System',
        description: 'next-intl, labels SSOT, and white-label i18n.',
        href: '/docs/features/locale-system',
      },
      {
        id: 'security',
        emoji: '🛡️',
        title: 'Security',
        description: 'RBAC, confidential entities, and hardening patterns.',
        href: '/docs/features/security',
      },
      {
        id: 'performance',
        emoji: '🚀',
        title: 'Performance',
        description: 'Caching, streaming SSR, and portal health checks.',
        href: '/docs/features/performance',
      },
      {
        id: 'doc-system',
        emoji: '📚',
        title: 'Doc System (MDX)',
        description: 'Ring doc widgets, Shiki, Mermaid, and section hubs.',
        href: '/docs/features/doc-system',
      },
      {
        id: 'refcodes',
        emoji: '🔗',
        title: 'Referral Codes',
        description: 'Attribution ledger and on-chain referral rewards.',
        href: '/docs/features/refcodes',
      },
    ],
  },
  {
    label: 'Build & automate',
    items: [
      {
        id: 'api',
        emoji: '🔌',
        title: 'API Reference',
        description: '132+ route handlers — entities, messaging, wallet, admin.',
        href: '/docs/api',
      },
      {
        id: 'mcp',
        emoji: '🤖',
        title: 'Ring MCP Tools',
        description: 'Model Context Protocol gateway for Cursor and CI.',
        href: '/docs/mcp',
      },
      {
        id: 'integrations',
        emoji: '🧩',
        title: 'Integrations Hub',
        description: 'Payments, wallets, OAuth, FCM, email, and automation.',
        href: '/docs/integrations',
      },
      {
        id: 'getting-started',
        emoji: '⚙️',
        title: 'Getting Started',
        description: 'install.sh, Postgres bootstrap, and first-success smoke tests.',
        href: '/docs/getting-started',
      },
    ],
  },
]

const copy: Record<Locale, WelcomeFeatureExplorerCopy> = {
  en: {
    title: 'Complete feature ecosystem',
    subtitle: '20+ production modules — pick your lens: product outcomes or developer depth.',
    tabProductOwner: 'Product owner',
    tabDeveloper: 'Developer',
    openDoc: 'Open documentation',
    productOwner: productOwnerEn,
    developer: developerEn,
  },
  uk: {
    title: 'Повна екосистема функцій',
    subtitle: '20+ production-модулів — оберіть фокус: продукт або розробка.',
    tabProductOwner: 'Власник продукту',
    tabDeveloper: 'Розробник',
    openDoc: 'Відкрити документацію',
    productOwner: [
      {
        label: 'Ядро',
        items: [
          {
            id: 'opportunities',
            emoji: '🎯',
            title: 'AI-підбір можливостей',
            description: '8-факторний matcher — можливості знаходять людей через DM.',
            href: '/docs/features/opportunities',
          },
          {
            id: 'entities',
            emoji: '🏢',
            title: 'Організації та сутності',
            description: '26 галузей, верифікація, профілі в каталозі.',
            href: '/docs/features/entities',
          },
          {
            id: 'messaging',
            emoji: '💬',
            title: 'Месенджер у реальному часі',
            description: 'Чат на Tunnel, прив’язаний до можливостей і угод.',
            href: '/docs/features/messaging',
          },
          {
            id: 'notifications',
            emoji: '🔔',
            title: 'Розумні сповіщення',
            description: 'Inbox, непрочитані, алерти matcher.',
            href: '/docs/features/notifications',
          },
        ],
      },
      {
        label: 'Бізнес',
        items: [
          {
            id: 'store',
            emoji: '🏪',
            title: 'Багатовендорний магазин',
            description: 'Онбординг продавців, комісії, кошик, checkout.',
            href: '/docs/features/store',
          },
          {
            id: 'wallet',
            emoji: '💰',
            title: 'Гаманець і платежі',
            description: 'RING credits, top-up, membership, fiat-рейки.',
            href: '/docs/features/wallet',
          },
          {
            id: 'nft-market',
            emoji: '🎨',
            title: 'NFT маркетплейс',
            description: 'White-label NFT listings і storefront.',
            href: '/docs/features/nft-market',
          },
          {
            id: 'staking',
            emoji: '💎',
            title: 'Стейкінг токенів',
            description: 'DeFi пули та governance weight.',
            href: '/docs/features/staking',
          },
          {
            id: 'payments',
            emoji: '💳',
            title: 'Платежі та WayForPay',
            description: 'PaymentConductor для магазину та членства.',
            href: '/docs/features/payments',
          },
          {
            id: 'affiliate',
            emoji: '🤝',
            title: 'Affiliate Enablement',
            description: 'ERP-комісії та platform token rewards.',
            href: '/docs/features/affiliate-enablement',
          },
        ],
      },
      {
        label: 'Контент і спільнота',
        items: [
          {
            id: 'news',
            emoji: '📰',
            title: 'News Kingdom',
            description: 'Редакційні workflow, generative newsroom.',
            href: '/docs/features/news',
          },
          {
            id: 'member-blog',
            emoji: '✍️',
            title: 'Member Blog',
            description: 'Пости учасників з модерацією.',
            href: '/docs/features/member-blog',
          },
          {
            id: 'scientific-editor',
            emoji: '🔬',
            title: 'Scientific Editor',
            description: 'Live agent chat для наукових публікацій.',
            href: '/docs/features/scientific-editor',
          },
          {
            id: 'email-crm',
            emoji: '📧',
            title: 'Email AI-CRM',
            description: 'IMAP ingest, AI-чернетки, admin send.',
            href: '/docs/features/email-ai-crm',
          },
          {
            id: 'erp',
            emoji: '🏭',
            title: 'ERP і кооперативи',
            description: 'FSMA traceability та vendor ops.',
            href: '/docs/features/erp',
          },
          {
            id: 'mobile',
            emoji: '📱',
            title: 'Mobile Experience',
            description: 'PWA, responsive nav, push-ready UX.',
            href: '/docs/features/mobile-experience',
          },
        ],
      },
    ],
    developer: [
      {
        label: 'Архітектура',
        items: [
          {
            id: 'architecture',
            emoji: '🏗️',
            title: 'Огляд архітектури',
            description: 'BackendSelector і потік даних.',
            href: '/docs/architecture',
          },
          {
            id: 'data-model',
            emoji: '📊',
            title: 'Архітектура БД',
            description: 'PostgreSQL schema v4, JSONB, PostGIS.',
            href: '/docs/architecture/data-model',
          },
          {
            id: 'backend-modes',
            emoji: '🗄️',
            title: 'Backend modes',
            description: 'k8s-postgres-fcm vs firebase-full.',
            href: '/docs/architecture/backend-modes-and-databases',
          },
          {
            id: 'real-time',
            emoji: '⚡',
            title: 'Realtime транспорт',
            description: 'WebSocket, SSE, long-poll.',
            href: '/docs/architecture/real-time',
          },
        ],
      },
      {
        label: 'Платформені модулі',
        items: [
          {
            id: 'authentication',
            emoji: '🔐',
            title: 'Аутентифікація',
            description: 'Auth.js v5, OAuth, magic links.',
            href: '/docs/features/authentication',
          },
          {
            id: 'tunnel',
            emoji: '📡',
            title: 'Tunnel Protocol',
            description: 'TunnelHub broker і React hooks.',
            href: '/docs/features/tunnel-protocol',
          },
          {
            id: 'payment-conductor',
            emoji: '🎛️',
            title: 'PaymentConductor',
            description: 'Ledger, webhooks, idempotency.',
            href: '/docs/features/payment-conductor',
          },
          {
            id: 'video-conductor',
            emoji: '🎬',
            title: 'VideoConductor',
            description: 'Generative video — 480p draft → 720p.',
            href: '/docs/features/video-conductor',
          },
          {
            id: 'fcm',
            emoji: '📲',
            title: 'Push (FCM)',
            description: 'Token registry і service worker.',
            href: '/docs/features/push-notifications-fcm',
          },
          {
            id: 'locale',
            emoji: '🌍',
            title: 'Locale System',
            description: 'next-intl і labels SSOT.',
            href: '/docs/features/locale-system',
          },
          {
            id: 'security',
            emoji: '🛡️',
            title: 'Security',
            description: 'RBAC і confidential entities.',
            href: '/docs/features/security',
          },
          {
            id: 'performance',
            emoji: '🚀',
            title: 'Performance',
            description: 'Caching, SSR, portal health.',
            href: '/docs/features/performance',
          },
          {
            id: 'doc-system',
            emoji: '📚',
            title: 'Doc System (MDX)',
            description: 'Ring widgets, Shiki, Mermaid.',
            href: '/docs/features/doc-system',
          },
          {
            id: 'refcodes',
            emoji: '🔗',
            title: 'Referral Codes',
            description: 'Attribution ledger і on-chain rewards.',
            href: '/docs/features/refcodes',
          },
        ],
      },
      {
        label: 'Збірка та автоматизація',
        items: [
          {
            id: 'api',
            emoji: '🔌',
            title: 'Довідник API',
            description: '132+ route handlers.',
            href: '/docs/api',
          },
          {
            id: 'mcp',
            emoji: '🤖',
            title: 'Ring MCP',
            description: 'MCP gateway для Cursor і CI.',
            href: '/docs/mcp',
          },
          {
            id: 'integrations',
            emoji: '🧩',
            title: 'Інтеграції',
            description: 'Платежі, гаманці, OAuth, FCM.',
            href: '/docs/integrations',
          },
          {
            id: 'getting-started',
            emoji: '⚙️',
            title: 'Початок роботи',
            description: 'install.sh і Postgres bootstrap.',
            href: '/docs/getting-started',
          },
        ],
      },
    ],
  },
  ru: {
    title: 'Полная экосистема функций',
    subtitle: '20+ production-модулей — выберите фокус: продукт или разработка.',
    tabProductOwner: 'Владелец продукта',
    tabDeveloper: 'Разработчик',
    openDoc: 'Открыть документацию',
    productOwner: [
      {
        label: 'Ядро',
        items: [
          {
            id: 'opportunities',
            emoji: '🎯',
            title: 'AI-подбор возможностей',
            description: '8-факторный matcher — возможности находят людей через DM.',
            href: '/docs/features/opportunities',
          },
          {
            id: 'entities',
            emoji: '🏢',
            title: 'Организации и сущности',
            description: '26 отраслей, верификация, профили в каталоге.',
            href: '/docs/features/entities',
          },
          {
            id: 'messaging',
            emoji: '💬',
            title: 'Мессенджер в реальном времени',
            description: 'Чат на Tunnel, привязанный к возможностям и сделкам.',
            href: '/docs/features/messaging',
          },
          {
            id: 'notifications',
            emoji: '🔔',
            title: 'Умные уведомления',
            description: 'Inbox, непрочитанные, алерты matcher.',
            href: '/docs/features/notifications',
          },
        ],
      },
      {
        label: 'Бизнес',
        items: [
          {
            id: 'store',
            emoji: '🏪',
            title: 'Мульти-вендор магазин',
            description: 'Онбординг продавцов, комиссии, корзина, checkout.',
            href: '/docs/features/store',
          },
          {
            id: 'wallet',
            emoji: '💰',
            title: 'Кошелёк и платежи',
            description: 'RING credits, top-up, membership, fiat-рельсы.',
            href: '/docs/features/wallet',
          },
          {
            id: 'nft-market',
            emoji: '🎨',
            title: 'NFT маркетплейс',
            description: 'White-label NFT listings и storefront.',
            href: '/docs/features/nft-market',
          },
          {
            id: 'staking',
            emoji: '💎',
            title: 'Стейкинг токенов',
            description: 'DeFi пулы и governance weight.',
            href: '/docs/features/staking',
          },
          {
            id: 'payments',
            emoji: '💳',
            title: 'Платежи и WayForPay',
            description: 'PaymentConductor для магазина и членства.',
            href: '/docs/features/payments',
          },
          {
            id: 'affiliate',
            emoji: '🤝',
            title: 'Affiliate Enablement',
            description: 'ERP-комиссии и platform token rewards.',
            href: '/docs/features/affiliate-enablement',
          },
        ],
      },
      {
        label: 'Контент и сообщество',
        items: [
          {
            id: 'news',
            emoji: '📰',
            title: 'News Kingdom',
            description: 'Редакционные workflow, generative newsroom.',
            href: '/docs/features/news',
          },
          {
            id: 'member-blog',
            emoji: '✍️',
            title: 'Member Blog',
            description: 'Посты участников с модерацией.',
            href: '/docs/features/member-blog',
          },
          {
            id: 'scientific-editor',
            emoji: '🔬',
            title: 'Scientific Editor',
            description: 'Live agent chat для научных публикаций.',
            href: '/docs/features/scientific-editor',
          },
          {
            id: 'email-crm',
            emoji: '📧',
            title: 'Email AI-CRM',
            description: 'IMAP ingest, AI-черновики, admin send.',
            href: '/docs/features/email-ai-crm',
          },
          {
            id: 'erp',
            emoji: '🏭',
            title: 'ERP и кооперативы',
            description: 'FSMA traceability и vendor ops.',
            href: '/docs/features/erp',
          },
          {
            id: 'mobile',
            emoji: '📱',
            title: 'Mobile Experience',
            description: 'PWA, responsive nav, push-ready UX.',
            href: '/docs/features/mobile-experience',
          },
        ],
      },
    ],
    developer: [
      {
        label: 'Архитектура',
        items: [
          {
            id: 'architecture',
            emoji: '🏗️',
            title: 'Обзор архитектуры',
            description: 'BackendSelector и поток данных.',
            href: '/docs/architecture',
          },
          {
            id: 'data-model',
            emoji: '📊',
            title: 'Архитектура БД',
            description: 'PostgreSQL schema v4, JSONB, PostGIS.',
            href: '/docs/architecture/data-model',
          },
          {
            id: 'backend-modes',
            emoji: '🗄️',
            title: 'Backend modes',
            description: 'k8s-postgres-fcm vs firebase-full.',
            href: '/docs/architecture/backend-modes-and-databases',
          },
          {
            id: 'real-time',
            emoji: '⚡',
            title: 'Realtime транспорт',
            description: 'WebSocket, SSE, long-poll.',
            href: '/docs/architecture/real-time',
          },
        ],
      },
      {
        label: 'Платформенные модули',
        items: [
          {
            id: 'authentication',
            emoji: '🔐',
            title: 'Аутентификация',
            description: 'Auth.js v5, OAuth, magic links.',
            href: '/docs/features/authentication',
          },
          {
            id: 'tunnel',
            emoji: '📡',
            title: 'Tunnel Protocol',
            description: 'TunnelHub broker и React hooks.',
            href: '/docs/features/tunnel-protocol',
          },
          {
            id: 'payment-conductor',
            emoji: '🎛️',
            title: 'PaymentConductor',
            description: 'Ledger, webhooks, idempotency.',
            href: '/docs/features/payment-conductor',
          },
          {
            id: 'video-conductor',
            emoji: '🎬',
            title: 'VideoConductor',
            description: 'Generative video — 480p draft → 720p.',
            href: '/docs/features/video-conductor',
          },
          {
            id: 'fcm',
            emoji: '📲',
            title: 'Push (FCM)',
            description: 'Token registry и service worker.',
            href: '/docs/features/push-notifications-fcm',
          },
          {
            id: 'locale',
            emoji: '🌍',
            title: 'Locale System',
            description: 'next-intl и labels SSOT.',
            href: '/docs/features/locale-system',
          },
          {
            id: 'security',
            emoji: '🛡️',
            title: 'Security',
            description: 'RBAC и confidential entities.',
            href: '/docs/features/security',
          },
          {
            id: 'performance',
            emoji: '🚀',
            title: 'Performance',
            description: 'Caching, SSR, portal health.',
            href: '/docs/features/performance',
          },
          {
            id: 'doc-system',
            emoji: '📚',
            title: 'Doc System (MDX)',
            description: 'Ring widgets, Shiki, Mermaid.',
            href: '/docs/features/doc-system',
          },
          {
            id: 'refcodes',
            emoji: '🔗',
            title: 'Referral Codes',
            description: 'Attribution ledger и on-chain rewards.',
            href: '/docs/features/refcodes',
          },
        ],
      },
      {
        label: 'Сборка и автоматизация',
        items: [
          {
            id: 'api',
            emoji: '🔌',
            title: 'Справочник API',
            description: '132+ route handlers.',
            href: '/docs/api',
          },
          {
            id: 'mcp',
            emoji: '🤖',
            title: 'Ring MCP',
            description: 'MCP gateway для Cursor и CI.',
            href: '/docs/mcp',
          },
          {
            id: 'integrations',
            emoji: '🧩',
            title: 'Интеграции',
            description: 'Платежи, кошельки, OAuth, FCM.',
            href: '/docs/integrations',
          },
          {
            id: 'getting-started',
            emoji: '⚙️',
            title: 'Начало работы',
            description: 'install.sh и Postgres bootstrap.',
            href: '/docs/getting-started',
          },
        ],
      },
    ],
  },
}

export function getWelcomeFeatureExplorerCopy(locale: Locale = 'en'): WelcomeFeatureExplorerCopy {
  return copy[locale] ?? copy.en
}
