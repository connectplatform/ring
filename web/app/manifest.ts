import type { MetadataRoute } from 'next'
import {
  getPublicInstanceConfigFromSnapshot,
  getSystemConfigSnapshot,
} from '@/lib/ring-config-core'

/** Standalone web app manifest — required for iOS 16.4+ Home Screen Web Push. */
export default function manifest(): MetadataRoute.Manifest {
  const pub = getPublicInstanceConfigFromSnapshot()
  const snap = getSystemConfigSnapshot()
  const apple =
    snap.branding?.logo?.appleTouchIcon || '/apple-touch-icon.png'
  const favicon = pub.brand.faviconUrl || '/favicon.ico'
  const logo = pub.brand.logoUrl || '/images/logo.svg'
  const shortName = snap.clone?.shortName || pub.name

  return {
    name: pub.name,
    short_name: shortName,
    description: pub.seo.defaultDescription,
    start_url: '/',
    display: 'standalone',
    background_color: pub.brand.colors.background,
    theme_color: pub.brand.colors.primary,
    icons: [
      {
        src: apple,
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: favicon,
        sizes: 'any',
        type: 'image/x-icon',
        purpose: 'any',
      },
      {
        src: logo,
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
