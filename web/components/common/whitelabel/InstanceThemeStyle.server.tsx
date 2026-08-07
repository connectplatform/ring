// Server Component: injects CSS variables for brand colors at runtime
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'

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
  const cfg = getSystemConfigSnapshot()
  const colors = cfg.branding?.colors
  const primary = colors?.primary ?? '#6366f1'
  const accent = colors?.accent ?? '#8b5cf6'

  // Keep background/foreground from theme defaults. Brand primary/accent drive
  // buttons (bg-primary), salad/secondary accents, and DaVinci CTA beam.
  const primaryHsl = hexToHslTriplet(primary)
  const accentHsl = hexToHslTriplet(accent)
  const css = [
    ':root{',
    `--primary:${primaryHsl};`,
    `--accent:${accentHsl};`,
    `--secondary:${accentHsl};`,
    `--ring:${primaryHsl};`,
    `--davinci-beam:hsl(${primaryHsl});`,
    `--davinci-beam-highlight:hsl(${accentHsl});`,
    '}',
  ].join('')
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
