/**
 * Client device context collector for Ring Analytics telemetry.
 * Coalesced snapshots: screen, device label, locale, connection, optional geo.
 */

'use client'

export type DeviceFormFactor = 'mobile' | 'tablet' | 'desktop' | 'unknown'

export interface DeviceScreenSnapshot {
  width: number
  height: number
  availWidth: number
  availHeight: number
  pixelRatio: number
  colorDepth: number
  orientation: string
}

export interface DeviceGeoSnapshot {
  latitude: number
  longitude: number
  accuracy: number
}

export interface DeviceContextSnapshot {
  deviceLabel: string
  formFactor: DeviceFormFactor
  screen: DeviceScreenSnapshot
  locale: string
  timezone: string
  connectionType?: string
  visibility: DocumentVisibilityState
  geo?: DeviceGeoSnapshot
}

function detectFormFactor(width: number, ua: string): DeviceFormFactor {
  const mobile = /Mobi|Android|iPhone|iPod/i.test(ua)
  const tablet = /iPad|Tablet/i.test(ua) || (mobile && width >= 768)
  if (tablet) return 'tablet'
  if (mobile || width < 768) return 'mobile'
  if (width >= 1024) return 'desktop'
  return 'unknown'
}

function buildDeviceLabel(ua: string, formFactor: DeviceFormFactor): string {
  if (typeof navigator !== 'undefined' && 'userAgentData' in navigator) {
    const hints = (navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } })
      .userAgentData
    if (hints?.platform) {
      return `${hints.platform} ${hints.mobile ? 'mobile' : formFactor}`
    }
  }

  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Macintosh/i.test(ua)) return 'macOS'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Linux/i.test(ua)) return 'Linux'
  return formFactor
}

export function collectDeviceContextSnapshot(): DeviceContextSnapshot {
  if (typeof window === 'undefined') {
    return {
      deviceLabel: 'server',
      formFactor: 'unknown',
      screen: {
        width: 0,
        height: 0,
        availWidth: 0,
        availHeight: 0,
        pixelRatio: 1,
        colorDepth: 24,
        orientation: 'unknown',
      },
      locale: 'en',
      timezone: 'UTC',
      visibility: 'visible',
    }
  }

  const ua = navigator.userAgent
  const width = window.innerWidth
  const formFactor = detectFormFactor(width, ua)
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } })
    .connection

  return {
    deviceLabel: buildDeviceLabel(ua, formFactor),
    formFactor,
    screen: {
      width,
      height: window.innerHeight,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      pixelRatio: window.devicePixelRatio ?? 1,
      colorDepth: window.screen.colorDepth,
      orientation:
        typeof window.screen.orientation?.type === 'string'
          ? window.screen.orientation.type
          : width > window.innerHeight
            ? 'landscape'
            : 'portrait',
    },
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    connectionType: conn?.effectiveType,
    visibility: document.visibilityState,
  }
}

/**
 * Optional coarse geo — only when user already granted geolocation.
 */
export function readCachedGeoSnapshot(): DeviceGeoSnapshot | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem('ring_device_geo_snapshot')
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as DeviceGeoSnapshot
    if (
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number'
    ) {
      return parsed
    }
  } catch {
    // ignore
  }
  return undefined
}

export function requestCoarseGeoOnce(): Promise<DeviceGeoSnapshot | undefined> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(undefined)
  }

  const cached = readCachedGeoSnapshot()
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const snap: DeviceGeoSnapshot = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        try {
          sessionStorage.setItem('ring_device_geo_snapshot', JSON.stringify(snap))
        } catch {
          // ignore quota
        }
        resolve(snap)
      },
      () => resolve(undefined),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
    )
  })
}

/** Significant change → allow immediate re-post (orientation bucket or form factor). */
export function deviceContextSignature(snapshot: DeviceContextSnapshot): string {
  const s = snapshot.screen
  const bucketW = Math.round(s.width / 50) * 50
  const bucketH = Math.round(s.height / 50) * 50
  return `${snapshot.formFactor}:${bucketW}x${bucketH}:${snapshot.visibility}`
}
