import 'server-only'

import { pathnameWithoutLocale } from '@/lib/seo-metadata'

/** Cached message bundles — smaller payloads for marketing / route groups. */
export type MessageScope =
  | 'public-home'
  | 'public'
  | 'public-store'
  | 'public-news'
  | 'authenticated'
  | 'admin'
  | 'confidential'
  | 'presentation'
  | 'full'

export type LocaleFileId =
  | 'common'
  | 'pages'
  | 'editor'
  | 'emails'
  | 'seo'
  | 'config'
  | 'about'
  | 'about-publisher'
  | 'calculator'
  | 'roadmap'
  | 'terms'
  | 'filters'
  | 'search'
  | 'comments'
  | 'privacy'
  | 'landing'
  | 'navigation'
  | 'global-impact'
  | 'tokenomics'
  | 'ai-web3'
  | 'contact'
  | 'docs'
  | 'meetups'
  | 'pets'
  | 'places'
  | 'subscriptions'
  | 'reviews'
  | 'modAuth'
  | 'modEntities'
  | 'modOpp'
  | 'modMessenger'
  | 'modWallet'
  | 'modStore'
  | 'modProfile'
  | 'modAdmin'
  | 'modSettings'
  | 'modMembership'
  | 'modNft'
  | 'modNews'
  | 'modNotifications'
  | 'modRefcodes'
  | 'vendor'
  | 'confidential'

const CORE: LocaleFileId[] = ['common', 'navigation', 'seo', 'config']

const PUBLIC_HOME: LocaleFileId[] = [
  ...CORE,
  'pages',
  'landing',
  'about',
  'modAuth',
  'modEntities',
  'modOpp',
  'modStore',
  'modMembership',
  'modProfile',
  'modSettings',
  'modWallet',
]

const PUBLIC_CONTENT: LocaleFileId[] = [
  'terms',
  'privacy',
  'filters',
  'search',
  'comments',
  'about-publisher',
  'calculator',
  'roadmap',
  'global-impact',
  'tokenomics',
  'ai-web3',
  'contact',
  'docs',
]

const PUBLIC_STORE_EXTRA: LocaleFileId[] = ['vendor']

const PUBLIC_NEWS_EXTRA: LocaleFileId[] = ['modNews']

const AUTHENTICATED_EXTRA: LocaleFileId[] = [
  'modProfile',
  'modSettings',
  'modWallet',
  'modRefcodes',
  'modMessenger',
  'modNft',
  'modNotifications',
  'vendor',
  'editor',
  'meetups',
  'pets',
  'places',
  'subscriptions',
  'reviews',
]

const ADMIN_EXTRA: LocaleFileId[] = ['modAdmin', 'modRefcodes', 'emails', 'editor', 'modNews']

const CONFIDENTIAL_EXTRA: LocaleFileId[] = ['confidential']

const PRESENTATION_EXTRA: LocaleFileId[] = ['pages', 'landing', 'modAuth']

const ALL_FILES: LocaleFileId[] = [
  ...CORE,
  'pages',
  'editor',
  'emails',
  'about',
  'about-publisher',
  'calculator',
  'roadmap',
  'terms',
  'filters',
  'search',
  'comments',
  'privacy',
  'landing',
  'global-impact',
  'tokenomics',
  'ai-web3',
  'contact',
  'docs',
  'meetups',
  'pets',
  'places',
  'subscriptions',
  'reviews',
  'modAuth',
  'modEntities',
  'modOpp',
  'modMessenger',
  'modWallet',
  'modStore',
  'modProfile',
  'modAdmin',
  'modSettings',
  'modMembership',
  'modNft',
  'modNews',
  'modNotifications',
  'modRefcodes',
  'vendor',
  'confidential',
]

function unique(ids: LocaleFileId[]): LocaleFileId[] {
  return [...new Set(ids)]
}

export function getLocaleFileIdsForScope(scope: MessageScope): LocaleFileId[] {
  switch (scope) {
    case 'public-home':
      return unique(PUBLIC_HOME)
    case 'public':
      return unique([...PUBLIC_HOME, ...PUBLIC_CONTENT])
    case 'public-store':
      return unique([...PUBLIC_HOME, ...PUBLIC_CONTENT, ...PUBLIC_STORE_EXTRA])
    case 'public-news':
      return unique([...PUBLIC_HOME, ...PUBLIC_CONTENT, ...PUBLIC_NEWS_EXTRA])
    case 'authenticated':
      return unique([...PUBLIC_HOME, ...PUBLIC_CONTENT, ...AUTHENTICATED_EXTRA])
    case 'admin':
      return unique([...PUBLIC_HOME, ...PUBLIC_CONTENT, ...AUTHENTICATED_EXTRA, ...ADMIN_EXTRA])
    case 'confidential':
      return unique([
        ...PUBLIC_HOME,
        ...PUBLIC_CONTENT,
        ...CONFIDENTIAL_EXTRA,
        'modProfile',
        'modSettings',
      ])
    case 'presentation':
      return unique([...CORE, ...PRESENTATION_EXTRA])
    case 'full':
    default:
      return unique(ALL_FILES)
  }
}

/** Resolve bundle from `x-pathname` (set in proxy.ts). */
export function resolveMessageScope(pathname: string): MessageScope {
  const p = pathnameWithoutLocale(pathname || '/')
  const normalized = p === '' ? '/' : p

  if (normalized.startsWith('/admin')) return 'admin'
  if (normalized.startsWith('/confidential')) return 'confidential'
  if (normalized.startsWith('/intro')) return 'presentation'
  if (
    /^\/(profile|settings|wallet|refcodes|vendor|entities|opportunities|contacts|notifications|meetups|pets|places|editor|publications)(\/|$)/.test(
      normalized,
    ) ||
    normalized.startsWith('/u/')
  ) {
    return 'authenticated'
  }
  if (normalized.startsWith('/store/checkout')) return 'authenticated'
  if (normalized === '/') return 'public-home'
  if (normalized.startsWith('/store')) return 'public-store'
  if (normalized.startsWith('/news')) return 'public-news'
  return 'public'
}
