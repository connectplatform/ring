import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'

/** Client-safe pathname strip for locale prefix (`localePrefix: as-needed` aware). */
export function pathnameWithoutLocaleClient(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0 && routing.locales.includes(segments[0] as Locale)) {
    const rest = segments.slice(1).join('/')
    return rest ? `/${rest}` : '/'
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

/** Routes that mount wagmi (wallet, checkout, login crypto, NFT). */
export function pathNeedsWeb3(pathWithoutLocale: string): boolean {
  const p = pathWithoutLocale === '' ? '/' : pathWithoutLocale
  return (
    p === '/login' ||
    p.startsWith('/auth/wallet-connect') ||
    p.startsWith('/wallet') ||
    p.startsWith('/store/checkout') ||
    p.startsWith('/nft') ||
    p.startsWith('/ai-web3')
  )
}
