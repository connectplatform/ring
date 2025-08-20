import fs from 'fs'
import path from 'path'

export type InstanceConfig = {
  name: string
  brand: {
    colors: { primary: string; background: string; foreground: string; accent: string }
    logoUrl?: string
    faviconUrl?: string
    ogImageUrl?: string
  }
  theme?: { default?: 'light' | 'dark' | 'system' }
  seo?: { titleSuffix?: string; defaultDescription?: string }
  navigation?: { links?: Array<{ label: string; href: string }> }
  hero?: { title?: string; subtitle?: string; ctaText?: string; ctaHref?: string; showOnHome?: boolean }
  features: Record<string, boolean>
}

let cached: InstanceConfig | null = null

export function getInstanceConfig(): InstanceConfig {
  if (cached) return cached
  const base = process.cwd()
  const localPath = path.join(base, 'whitelabel', 'instance.config.json')
  const defaultPath = path.join(base, 'whitelabel', 'examples', 'default.json')
  const p = fs.existsSync(localPath) ? localPath : defaultPath
  const raw = fs.readFileSync(p, 'utf-8')
  cached = JSON.parse(raw)
  return cached!
}

export function getBrandColors() {
  const { brand } = getInstanceConfig()
  return brand.colors
}

export function isFeatureEnabled(key: string, defaultValue = true) {
  const { features } = getInstanceConfig()
  return features[key] ?? defaultValue
}
