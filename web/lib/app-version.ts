import packageJson from '../package.json'

/** Build-time app version from package.json (SSOT for public chrome). */
export const APP_VERSION = packageJson.version as string

/** Display form: `v.1.97.6` */
export function formatAppVersionLabel(version: string = APP_VERSION): string {
  const cleaned = version.replace(/^v\.?/i, '')
  return `v.${cleaned}`
}
