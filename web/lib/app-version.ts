import packageJson from '../package.json'

/** Build-time app version from package.json (SSOT for public chrome). */
export const APP_VERSION = packageJson.version as string

/** L3 overlay build from `.ring-overlay-version` (compose) or `0` on bare L1. */
export const OVERLAY_BUILD = (process.env.NEXT_PUBLIC_RING_OVERLAY_VERSION || '0').trim()

/** Display form: `v.1.97.6` */
export function formatAppVersionLabel(version: string = APP_VERSION): string {
  const cleaned = version.replace(/^v\.?/i, '')
  return `v.${cleaned}`
}

/**
 * Public chrome — same triple as forge CI: `vMAJOR.LAYER1.OVERLAY`.
 * Layer1 `package.json` is `MAJOR.LAYER1.0`; overlay digit comes from
 * `.ring-overlay-version` (0 on bare L1).
 */
export function formatPublicVersionLabel(
  version: string = APP_VERSION,
  overlay: string = OVERLAY_BUILD,
): string {
  const cleaned = version.replace(/^v\.?/i, '')
  const [major = '0', layer1 = '0'] = cleaned.split('.')
  const overlayDigit = /^[0-9]+$/.test(overlay) ? overlay : '0'
  return `v${major}.${layer1}.${overlayDigit}`
}
