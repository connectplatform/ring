// Server Component: injects CSS variables for brand colors at runtime
import { getInstanceConfig } from '@/lib/instance-config'

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const bigint = parseInt(normalized.length === 3 ? normalized.split('').map(c => c + c).join('') : normalized, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return { r, g, b }
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hexToHslTriplet(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const { h, s, l } = rgbToHsl(r, g, b)
  return `${h} ${s}% ${l}%`
}

export default function InstanceThemeStyle() {
  const cfg = getInstanceConfig()
  const { primary, accent } = cfg.brand.colors

  // Keep background/foreground from the theme defaults to avoid inverted colors.
  // Only brand primary and accent are injected at runtime.
  const css = `:root{--primary:${hexToHslTriplet(primary)};--accent:${hexToHslTriplet(accent)};}`
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
