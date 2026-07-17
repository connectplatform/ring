/**
 * Ring Platform locale configuration — routing, preferences, SEO, client scripts.
 *
 * Deploy overrides:
 * - `NEXT_PUBLIC_SUPPORTED_LOCALES` — comma-separated (default: `en,uk,ru,es,de`)
 * - `NEXT_PUBLIC_DEFAULT_LOCALE` — must appear in supported list (default: `en`)
 */

export const FALLBACK_SUPPORTED_LOCALES = ['en', 'uk', 'ru', 'es', 'de'] as const
export const FALLBACK_DEFAULT_LOCALE = 'en' as const

export type Locale = (typeof FALLBACK_SUPPORTED_LOCALES)[number]

export type LegacyBrowserGateCopy = {
  title: string
  description: string
  minimumRequirements: string
  chrome: string
  safari: string
  firefox: string
  downloadChrome: string
  downloadFirefox: string
}

const SITE_NAME = process.env.NEXT_PUBLIC_LEGACY_BROWSER_SITE_NAME?.trim() || 'Ring Platform'

function parseLocaleList(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [...FALLBACK_SUPPORTED_LOCALES]
  }
  const parsed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return parsed.length > 0 ? parsed : [...FALLBACK_SUPPORTED_LOCALES]
}

const envDefault = process.env.NEXT_PUBLIC_DEFAULT_LOCALE?.trim().toLowerCase()
const parsedList = parseLocaleList(process.env.NEXT_PUBLIC_SUPPORTED_LOCALES)

export const DEFAULT_LOCALE: Locale = (
  envDefault && parsedList.includes(envDefault)
    ? envDefault
    : parsedList.includes(FALLBACK_DEFAULT_LOCALE)
      ? FALLBACK_DEFAULT_LOCALE
      : (parsedList[0] as Locale)
) as Locale

export const SUPPORTED_LOCALES: readonly Locale[] = (
  parsedList.includes(DEFAULT_LOCALE)
    ? (parsedList as Locale[])
    : ([DEFAULT_LOCALE, ...parsedList] as Locale[])
) as readonly Locale[]

export const supportedLocales = SUPPORTED_LOCALES
export const defaultLocale = DEFAULT_LOCALE

export function isValidLocale(input: string): input is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(input)
}

export function resolveLocale(input: string | undefined | null): Locale {
  if (input && isValidLocale(input)) return input
  return DEFAULT_LOCALE
}

export const LOCALE_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  en: 'EN',
  uk: 'UA',
  ru: 'RU',
  es: 'ES',
  de: 'DE',
}

export const LOCALE_NATIVE_TITLES: Readonly<Record<string, string>> = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
  es: 'Español',
  de: 'Deutsch',
}

export const INTL_DATE_LOCALE: Readonly<Record<string, string>> = {
  en: 'en-US',
  uk: 'uk-UA',
  ru: 'ru-RU',
  es: 'es-ES',
  de: 'de-DE',
}

export const OPEN_GRAPH_LOCALE: Readonly<Record<string, string>> = {
  en: 'en_US',
  uk: 'uk_UA',
  ru: 'ru_RU',
  es: 'es_ES',
  de: 'de_DE',
}

export const LOCALE_PAYMENT_DISPLAY: Readonly<Record<string, string>> = {
  en: 'EN',
  uk: 'UA',
  ru: 'RU',
  es: 'ES',
  de: 'DE',
}

export const LEGACY_BROWSER_GATE: Readonly<Record<string, LegacyBrowserGateCopy>> = {
  en: {
    title: 'Browser Update Required',
    description: `${SITE_NAME} requires a modern browser to provide you with the best experience.`,
    minimumRequirements: 'Minimum Requirements:',
    chrome: 'Chrome/Edge 111+ (March 2023)',
    safari: 'Safari 16.4+ (March 2023)',
    firefox: 'Firefox 109+ (January 2023)',
    downloadChrome: 'Download Chrome',
    downloadFirefox: 'Download Firefox',
  },
  uk: {
    title: 'Потрібне оновлення браузера',
    description: `${SITE_NAME} потребує сучасного браузера для найкращого досвіду використання.`,
    minimumRequirements: 'Мінімальні вимоги:',
    chrome: 'Chrome/Edge 111+ (березень 2023)',
    safari: 'Safari 16.4+ (березень 2023)',
    firefox: 'Firefox 109+ (січень 2023)',
    downloadChrome: 'Завантажити Chrome',
    downloadFirefox: 'Завантажити Firefox',
  },
  ru: {
    title: 'Требуется обновление браузера',
    description: `${SITE_NAME} требует современного браузера для наилучшего опыта использования.`,
    minimumRequirements: 'Минимальные требования:',
    chrome: 'Chrome/Edge 111+ (март 2023)',
    safari: 'Safari 16.4+ (март 2023)',
    firefox: 'Firefox 109+ (январь 2023)',
    downloadChrome: 'Скачать Chrome',
    downloadFirefox: 'Скачать Firefox',
  },
  es: {
    title: 'Se requiere actualizar el navegador',
    description: `${SITE_NAME} necesita un navegador moderno para ofrecerte la mejor experiencia.`,
    minimumRequirements: 'Requisitos mínimos:',
    chrome: 'Chrome/Edge 111+ (marzo 2023)',
    safari: 'Safari 16.4+ (marzo 2023)',
    firefox: 'Firefox 109+ (enero 2023)',
    downloadChrome: 'Descargar Chrome',
    downloadFirefox: 'Descargar Firefox',
  },
  de: {
    title: 'Browser-Update erforderlich',
    description: `${SITE_NAME} benötigt einen modernen Browser für die beste Nutzungserfahrung.`,
    minimumRequirements: 'Mindestanforderungen:',
    chrome: 'Chrome/Edge 111+ (März 2023)',
    safari: 'Safari 16.4+ (März 2023)',
    firefox: 'Firefox 109+ (Januar 2023)',
    downloadChrome: 'Chrome herunterladen',
    downloadFirefox: 'Firefox herunterladen',
  },
}

export function getClientLocaleConfig(): {
  defaultLocale: string
  supportedLocales: readonly string[]
} {
  return {
    defaultLocale: DEFAULT_LOCALE,
    supportedLocales: SUPPORTED_LOCALES,
  }
}

export function generateHreflangAlternates(pathname: string): Record<string, string> {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const map: Record<string, string> = {}
  for (const loc of SUPPORTED_LOCALES) {
    map[loc] = `/${loc}${normalized}`
  }
  return map
}

export function buildMetadataLanguageAlternates(pathSuffix: string): Record<string, string> {
  const suffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`
  const map: Record<string, string> = {}
  for (const loc of SUPPORTED_LOCALES) {
    map[loc] = `/${loc}${suffix === '/' ? '' : suffix}`
  }
  return map
}

export function localeDisplayLabel(code: string): string {
  return LOCALE_DISPLAY_LABELS[code] ?? code.toUpperCase()
}

export function localeNativeTitle(code: string): string {
  return LOCALE_NATIVE_TITLES[code] ?? code
}

export function intlDateLocale(locale: string): string {
  return INTL_DATE_LOCALE[locale] ?? INTL_DATE_LOCALE[DEFAULT_LOCALE] ?? 'en-US'
}

export function openGraphLocaleTag(locale: string): string {
  return OPEN_GRAPH_LOCALE[locale] ?? OPEN_GRAPH_LOCALE[DEFAULT_LOCALE] ?? 'en_US'
}

export function openGraphAlternateLocaleTags(locale: string): string[] {
  const primary = openGraphLocaleTag(locale)
  return SUPPORTED_LOCALES.map((loc) => openGraphLocaleTag(loc)).filter(
    (tag) => tag !== primary,
  )
}

export function paymentDisplayLocale(locale: string): string {
  return LOCALE_PAYMENT_DISPLAY[locale] ?? LOCALE_PAYMENT_DISPLAY[DEFAULT_LOCALE] ?? 'EN'
}

export function pickLocaleText(
  locale: string,
  texts: Partial<Record<string, string>> & Record<string, string>,
): string
export function pickLocaleText(
  locale: string,
  defaultText: string,
  uk?: string,
  ru?: string,
): string
export function pickLocaleText(
  locale: string,
  defaultTextOrTexts: string | (Partial<Record<string, string>> & Record<string, string>),
  uk?: string,
  ru?: string,
): string {
  if (typeof defaultTextOrTexts === 'object') {
    const texts = defaultTextOrTexts
    if (texts[locale]) return texts[locale]!
    if (texts[DEFAULT_LOCALE]) return texts[DEFAULT_LOCALE]!
    for (const loc of SUPPORTED_LOCALES) {
      if (texts[loc]) return texts[loc]!
    }
    return Object.values(texts)[0] ?? ''
  }

  const texts: Record<string, string> = { [DEFAULT_LOCALE]: defaultTextOrTexts }
  if (uk !== undefined) texts.uk = uk
  if (ru !== undefined) texts.ru = ru
  if (defaultTextOrTexts && DEFAULT_LOCALE !== 'en') texts.en = defaultTextOrTexts
  return pickLocaleText(locale, texts)
}

export function editorContentLocale(locale: string): Locale {
  return resolveLocale(locale)
}

const LOCALE_SELECT_FLAGS: Partial<Record<string, string>> = {
  en: '🇺🇸',
  uk: '🇺🇦',
  ru: '🇷🇺',
  es: '🇪🇸',
  de: '🇩🇪',
}

export function getLocaleSelectOptions(): Array<{ value: Locale; label: string }> {
  return SUPPORTED_LOCALES.map((value) => {
    const flag = localeFlagEmoji(value)
    const title = localeNativeTitle(value)
    return {
      value,
      label: flag ? `${flag} ${title}` : title,
    }
  })
}

export function localeFlagEmoji(code: string): string {
  return LOCALE_SELECT_FLAGS[code] ?? ''
}
