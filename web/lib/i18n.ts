import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/lib/locale-config'
import {
  getLocaleFileIdsForScope,
  type LocaleFileId,
  type MessageScope,
} from '@/lib/i18n/message-scopes'
import { getPlatformIdentity } from '@/lib/ring-config-core'

export type JsonRecord = Record<string, any>

export function getMessageSection<T extends JsonRecord = JsonRecord>(
  messages: JsonRecord,
  key: string,
): T {
  const section = messages[key]
  return section && typeof section === 'object' && !Array.isArray(section)
    ? (section as T)
    : ({} as T)
}

type TargetLocale = Locale

function normalizeLocale(locale: string): TargetLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as TargetLocale)
    : DEFAULT_LOCALE
}

async function importLocaleFile(
  targetLocale: TargetLocale,
  fileId: LocaleFileId,
): Promise<JsonRecord> {
  switch (fileId) {
    case 'common':
      return import(`@/locales/${targetLocale}/common.json`).then((m) => m.default).catch(() => ({}))
    case 'pages':
      return import(`@/locales/${targetLocale}/pages.json`).then((m) => m.default).catch(() => ({}))
    case 'editor':
      return import(`@/locales/${targetLocale}/editor.json`).then((m) => m.default).catch(() => ({}))
    case 'emails':
      return import(`@/locales/${targetLocale}/emails.json`).then((m) => m.default).catch(() => ({}))
    case 'seo':
      return import(`@/locales/${targetLocale}/seo.json`).then((m) => m.default).catch(() => ({}))
    case 'config':
      return import(`@/locales/${targetLocale}/config.json`).then((m) => m.default).catch(() => ({}))
    case 'about':
      return import(`@/locales/${targetLocale}/about.json`).then((m) => m.default).catch(() => ({}))
    case 'about-publisher':
      return import(`@/locales/${targetLocale}/about-publisher.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'calculator':
      return import(`@/locales/${targetLocale}/calculator.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'roadmap':
      return import(`@/locales/${targetLocale}/roadmap.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'terms':
      return import(`@/locales/${targetLocale}/terms.json`).then((m) => m.default).catch(() => ({}))
    case 'filters':
      return import(`@/locales/${targetLocale}/filters.json`).then((m) => m.default).catch(() => ({}))
    case 'search':
      return import(`@/locales/${targetLocale}/search.json`).then((m) => m.default).catch(() => ({}))
    case 'comments':
      return import(`@/locales/${targetLocale}/comments.json`).then((m) => m.default).catch(() => ({}))
    case 'privacy':
      return import(`@/locales/${targetLocale}/privacy.json`).then((m) => m.default).catch(() => ({}))
    case 'landing':
      return import(`@/locales/${targetLocale}/landing.json`).then((m) => m.default).catch(() => ({}))
    case 'navigation':
      return import(`@/locales/${targetLocale}/navigation.json`).then((m) => m.default).catch(() => ({}))
    case 'global-impact':
      return import(`@/locales/${targetLocale}/global-impact.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'tokenomics':
      return import(`@/locales/${targetLocale}/tokenomics.json`).then((m) => m.default).catch(() => ({}))
    case 'ai-web3':
      return import(`@/locales/${targetLocale}/ai-web3.json`).then((m) => m.default).catch(() => ({}))
    case 'contact':
      return import(`@/locales/${targetLocale}/contact.json`).then((m) => m.default).catch(() => ({}))
    case 'docs':
      return import(`@/locales/${targetLocale}/docs.json`).then((m) => m.default).catch(() => ({}))
    case 'meetups':
      return import(`@/locales/${targetLocale}/meetups.json`).then((m) => m.default).catch(() => ({}))
    case 'pets':
      return import(`@/locales/${targetLocale}/pets.json`).then((m) => m.default).catch(() => ({}))
    case 'places':
      return import(`@/locales/${targetLocale}/places.json`).then((m) => m.default).catch(() => ({}))
    case 'subscriptions':
      return import(`@/locales/${targetLocale}/subscriptions.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'reviews':
      return import(`@/locales/${targetLocale}/reviews.json`).then((m) => m.default).catch(() => ({}))
    case 'modAuth':
      return import(`@/locales/${targetLocale}/modules/auth.json`).then((m) => m.default).catch(() => ({}))
    case 'modEntities':
      return import(`@/locales/${targetLocale}/modules/entities.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modOpp':
      return import(`@/locales/${targetLocale}/modules/opportunities.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modMessenger':
      return import(`@/locales/${targetLocale}/modules/messenger.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modGames':
      return import(`@/locales/${targetLocale}/modules/games.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modTasks':
      return import(`@/locales/${targetLocale}/modules/tasks.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modContacts':
      return import(`@/locales/${targetLocale}/modules/contacts.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modFileCabinet':
      return import(`@/locales/${targetLocale}/modules/fileCabinet.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modWallet':
      return import(`@/locales/${targetLocale}/modules/wallet.json`).then((m) => m.default).catch(() => ({}))
    case 'modStore':
      return import(`@/locales/${targetLocale}/modules/store.json`).then((m) => m.default).catch(() => ({}))
    case 'modProfile':
      return import(`@/locales/${targetLocale}/modules/profile.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modAdmin':
      return import(`@/locales/${targetLocale}/modules/admin.json`).then((m) => m.default).catch(() => ({}))
    case 'modSettings':
      return import(`@/locales/${targetLocale}/modules/settings.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modMembership':
      return import(`@/locales/${targetLocale}/modules/membership.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modNft':
      return import(`@/locales/${targetLocale}/modules/nft.json`).then((m) => m.default).catch(() => ({}))
    case 'modGenerativeMedia':
      return import(`@/locales/${targetLocale}/modules/generativeMedia.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modNews':
      return import(`@/locales/${targetLocale}/modules/news.json`).then((m) => m.default).catch(() => ({}))
    case 'modMoodPlayer':
      return import(`@/locales/${targetLocale}/modules/moodPlayer.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modNotifications':
      return import(`@/locales/${targetLocale}/modules/notifications.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modRefcodes':
      return import(`@/locales/${targetLocale}/modules/refcodes.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modDao':
      return import(`@/locales/${targetLocale}/modules/dao.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'modAccount':
      return import(`@/locales/${targetLocale}/modules/account.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    case 'vendor':
      return import(`@/locales/${targetLocale}/vendor.json`).then((m) => m.default).catch(() => ({}))
    case 'confidential':
      return import(`@/locales/${targetLocale}/confidential.json`)
        .then((m) => m.default)
        .catch(() => ({}))
    default:
      return {}
  }
}

function walletTopupFromSeo(seo: JsonRecord): { title?: string; description?: string } {
  const wallet = seo?.wallet
  if (!wallet || typeof wallet !== 'object') return {}
  const topup = (wallet as JsonRecord).topup
  if (!topup || typeof topup !== 'object') return {}
  const t = (topup as JsonRecord).title
  const d = (topup as JsonRecord).description
  return {
    title: typeof t === 'string' ? t : undefined,
    description: typeof d === 'string' ? d : undefined,
  }
}

function buildConfigMessages(loadedConfig?: JsonRecord): JsonRecord {
  const identity = getPlatformIdentity()
  const localeTagline =
    (loadedConfig?.platform as Record<string, unknown> | undefined)?.tagline ?? ''
  return {
    platform: {
      name: identity.name,
      shortName: identity.shortName,
      domain: identity.domain,
      demoUserEmail: identity.demoUserEmail,
      tagline: localeTagline,
    },
  }
}

function assembleMessages(loaded: Partial<Record<LocaleFileId, JsonRecord>>): JsonRecord {
  const modNews = (loaded.modNews ?? {}) as JsonRecord & {
    myNews?: string
    myNewsDescription?: string
  }
  const topup = loaded.seo ? walletTopupFromSeo(loaded.seo) : {}

  const messages: JsonRecord = {}

  if (loaded.common) messages.common = loaded.common
  if (loaded.pages) messages.pages = loaded.pages
  if (loaded.editor) messages.editor = loaded.editor
  if (loaded.emails) messages.emails = loaded.emails
  if (loaded.seo) messages.seo = loaded.seo
  messages.config = buildConfigMessages(loaded.config)
  if (loaded.about) messages.about = loaded.about
  if (loaded['about-publisher']) messages['about-publisher'] = loaded['about-publisher']
  if (loaded.calculator) messages.calculator = loaded.calculator
  if (loaded.roadmap) messages.roadmap = loaded.roadmap
  if (loaded.terms) messages.terms = loaded.terms
  if (loaded.filters) messages.filters = loaded.filters
  if (loaded.search) messages.search = loaded.search
  if (loaded.comments) messages.comments = loaded.comments
  if (loaded.privacy) messages.privacy = loaded.privacy
  if (loaded.landing) messages.landing = loaded.landing
  if (loaded.navigation) messages.navigation = loaded.navigation
  if (loaded['global-impact']) messages['global-impact'] = loaded['global-impact']
  if (loaded.tokenomics) messages.tokenomics = loaded.tokenomics
  if (loaded['ai-web3']) messages['ai-web3'] = loaded['ai-web3']
  if (loaded.contact) messages.contact = loaded.contact
  if (loaded.docs) messages.docs = loaded.docs
  if (loaded.meetups) messages.meetups = loaded.meetups
  if (loaded.pets) messages.pets = loaded.pets
  if (loaded.places) messages.places = loaded.places
  if (loaded.subscriptions) messages.subscriptions = loaded.subscriptions
  if (loaded.reviews) messages.reviews = loaded.reviews
  if (loaded.confidential) messages.confidential = loaded.confidential
  if (loaded.vendor) messages.vendor = loaded.vendor

  if (loaded.modNews) {
    messages.news = {
      ...modNews,
      'my-news': {
        title: modNews.myNews,
        description: modNews.myNewsDescription,
      },
    }
  }

  if (topup.title || topup.description) {
    messages.wallet = {
      topup: {
        metadata: topup.title ? { title: topup.title } : undefined,
        metaDescription: topup.description ? { description: topup.description } : undefined,
      },
    }
  }

  const modules: JsonRecord = {}
  if (loaded.modAuth) modules.auth = loaded.modAuth
  if (loaded.modEntities) modules.entities = loaded.modEntities
  if (loaded.modOpp) modules.opportunities = loaded.modOpp
  if (loaded.modMessenger) modules.messenger = loaded.modMessenger
  if (loaded.modGames) modules.games = loaded.modGames
  if (loaded.modTasks) modules.tasks = loaded.modTasks
  if (loaded.modContacts) modules.contacts = loaded.modContacts
  if (loaded.modFileCabinet) modules.fileCabinet = loaded.modFileCabinet
  if (loaded.modWallet) modules.wallet = loaded.modWallet
  if (loaded.modStore) modules.store = loaded.modStore
  if (loaded.modProfile) modules.profile = loaded.modProfile
  if (loaded.modAdmin) modules.admin = loaded.modAdmin
  if (loaded.modSettings) modules.settings = loaded.modSettings
  if (loaded.modMembership) modules.membership = loaded.modMembership
  if (loaded.modNft) modules.nft = loaded.modNft
  if (loaded.modGenerativeMedia) modules.generativeMedia = loaded.modGenerativeMedia
  if (loaded.modMoodPlayer) modules.moodPlayer = loaded.modMoodPlayer
  if (loaded.modNotifications) {
    messages.notifications = loaded.modNotifications
    modules.notifications = loaded.modNotifications
  }
  if (loaded.modRefcodes) modules.refcodes = loaded.modRefcodes
  if (loaded.modDao) modules.dao = loaded.modDao
  if (loaded.modAccount) modules.account = loaded.modAccount
  // Alias so `getTranslations('modules.news')` resolves (canonical is top-level `news`)
  if (loaded.modNews) modules.news = loaded.modNews
  if (Object.keys(modules).length > 0) messages.modules = modules

  return messages
}

function mergeJsonRecords(target: JsonRecord, source: JsonRecord): JsonRecord {
  const out: JsonRecord = { ...target }
  for (const [key, value] of Object.entries(source)) {
    const existing = out[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      out[key] = mergeJsonRecords(existing as JsonRecord, value as JsonRecord)
    } else {
      out[key] = value
    }
  }
  return out
}

/**
 * L1 locale files only. Clone overlays must NOT live in this cache — overlay
 * JSON / registry change independently and `'use cache'` would freeze an empty
 * `vikka-home` / `n9life-home` namespace for hours.
 */
async function buildCachedLocaleMessages(
  locale: string,
  scope: MessageScope,
): Promise<JsonRecord> {
  'use cache'
  const loc = normalizeLocale(locale)
  cacheTag('intl-messages', `locale-${loc}`, `scope-${scope}`)
  cacheLife('hours')

  const fileIds = getLocaleFileIdsForScope(scope)
  const entries = await Promise.all(
    fileIds.map(async (fileId) => [fileId, await importLocaleFile(loc, fileId)] as const),
  )
  const loaded = Object.fromEntries(entries) as Partial<Record<LocaleFileId, JsonRecord>>
  return assembleMessages(loaded)
}

/**
 * Build next-intl messages for a locale and route scope.
 * Scoped L1 bundles are cached; Tier-3 overlay messages merge per request.
 */
export async function buildMessages(
  locale: string,
  scope: MessageScope = 'full',
): Promise<JsonRecord> {
  const loc = normalizeLocale(locale)
  const messages = await buildCachedLocaleMessages(loc, scope)
  const { loadOverlayMessages } = await import('@/lib/overlay/runtime')
  const overlay = await loadOverlayMessages(loc)
  if (!overlay || typeof overlay !== 'object') return messages
  return mergeJsonRecords(messages, overlay as JsonRecord)
}

/** @deprecated Prefer `buildMessages(locale, scope)` — loads full corpus. */
export async function buildMessagesFull(locale: string): Promise<JsonRecord> {
  return buildMessages(locale, 'full')
}
