import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/lib/locale-config'

/** Strip leading `/uk`, `/ru`, … when present (localePrefix: as-needed aware). */
export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0 && SUPPORTED_LOCALES.includes(segments[0] as Locale)) {
    const rest = segments.slice(1).join('/')
    return rest ? `/${rest}` : '/'
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

/** Client-safe pathname strip for locale prefix (`localePrefix: as-needed` aware). */
export function pathnameWithoutLocaleClient(pathname: string): string {
  return stripLocalePrefix(pathname)
}

/** Resolve active locale from pathname (`localePrefix: as-needed` aware). Root-shell safe. */
export function localeFromPathname(pathname: string | null): Locale {
  const pathLocale = pathname?.split('/')[1]
  return pathLocale && SUPPORTED_LOCALES.includes(pathLocale as Locale)
    ? (pathLocale as Locale)
    : DEFAULT_LOCALE
}

/** Routes that mount wagmi (wallet, checkout, login crypto, NFT, admin web3). */
export function pathNeedsWeb3(pathWithoutLocale: string): boolean {
  const p = pathWithoutLocale === '' ? '/' : pathWithoutLocale
  return (
    p.startsWith('/login') ||
    p.startsWith('/auth/wallet-connect') ||
    p.startsWith('/wallet') ||
    p.startsWith('/store/checkout') ||
    p.startsWith('/nft') ||
    p.startsWith('/ai-web3') ||
    p.startsWith('/admin/nft') ||
    p.startsWith('/admin/web3')
  )
}
