import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export function buildSocialProfileUrl(
  network:
    | 'x'
    | 'linkedIn'
    | 'facebook'
    | 'instagram'
    | 'telegram'
    | 'whatsApp'
    | 'project',
  value: string,
  locale?: Locale,
): string {
  const username = value.replace(/^@/, '').trim()
  switch (network) {
    case 'x':
      return `https://x.com/${encodeURIComponent(username)}`
    case 'linkedIn':
      return `https://www.linkedin.com/in/${encodeURIComponent(username)}`
    case 'facebook':
      return `https://www.facebook.com/${encodeURIComponent(username)}`
    case 'instagram':
      return `https://www.instagram.com/${encodeURIComponent(username)}`
    case 'telegram':
      return `https://t.me/${encodeURIComponent(username)}`
    case 'whatsApp': {
      const digits = value.replace(/\D/g, '')
      return `https://wa.me/${digits}`
    }
    case 'project':
      return ROUTES.PUBLIC_PROFILE(username, locale)
    default:
      return '#'
  }
}
