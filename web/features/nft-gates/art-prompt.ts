/**
 * NFT gate art prompt interpolation from ring-config / branding.
 * Placeholders: $projectName, $activeColor, $secondaryColor, $projectColor1, $projectColor2,
 * $shortName, $organization, $description, $version
 */

import { readFile } from 'fs/promises'
import path from 'path'
import { getBrandColors, getSystemConfigSnapshot } from '@/lib/ring-config-core'

export type GateArtPromptVars = {
  projectName: string
  shortName: string
  organization: string
  description: string
  version: string
  activeColor: string
  secondaryColor: string
  projectColor1: string
  projectColor2: string
}

export function getGateArtPromptVars(): GateArtPromptVars {
  const cfg = getSystemConfigSnapshot()
  const colors = getBrandColors()
  const projectName =
    cfg.clone?.displayName ||
    cfg.seo?.siteName ||
    'Ring Platform'
  const activeColor = colors.primary || '#3b82f6'
  const secondaryColor = colors.accent || '#22c55e'

  return {
    projectName,
    shortName: cfg.clone?.shortName || projectName,
    organization: cfg.clone?.organization || 'ConnectPlatform',
    description: cfg.clone?.description || '',
    version: cfg.clone?.version || '',
    activeColor,
    secondaryColor,
    projectColor1: activeColor,
    projectColor2: secondaryColor,
  }
}

/** Append brand-color guidance when template omits it. */
export function ensureGateArtColorClause(prompt: string, vars: GateArtPromptVars): string {
  if (/\$activeColor|active color:/i.test(prompt)) return prompt
  return (
    `${prompt.trim()} ` +
    `active color: ${vars.activeColor}, secondary color: ${vars.secondaryColor}, ` +
    `use colors in object: ${vars.projectColor1},${vars.projectColor2}.`
  )
}

export function interpolateGateArtPrompt(
  template: string,
  vars: GateArtPromptVars = getGateArtPromptVars(),
): string {
  const withColors = ensureGateArtColorClause(template, vars)
  return withColors
    .replaceAll('$projectName', vars.projectName)
    .replaceAll('$shortName', vars.shortName)
    .replaceAll('$organization', vars.organization)
    .replaceAll('$description', vars.description)
    .replaceAll('$version', vars.version)
    .replaceAll('$activeColor', vars.activeColor)
    .replaceAll('$secondaryColor', vars.secondaryColor)
    .replaceAll('$projectColor1', vars.projectColor1)
    .replaceAll('$projectColor2', vars.projectColor2)
    .replaceAll('#projectColor1', vars.projectColor1)
    .replaceAll('#projectColor2', vars.projectColor2)
}

/**
 * Load project favicon as PNG data-URI for xAI /images/edits reference.
 * Prefers public/images/favicon.png; falls back to converting .ico bytes as PNG MIME
 * when a PNG sibling exists, else raw file as data URI (xAI accepts PNG/JPEG/WebP).
 */
export async function loadProjectFaviconPngDataUri(): Promise<string | null> {
  const candidates = [
    path.join(process.cwd(), 'public/images/favicon.png'),
    path.join(process.cwd(), 'public/favicon.png'),
    path.join(process.cwd(), 'public/images/favicon.ico'),
    path.join(process.cwd(), 'public/favicon.ico'),
  ]

  for (const filePath of candidates) {
    try {
      const buf = await readFile(filePath)
      const isPng = filePath.endsWith('.png') || buf[0] === 0x89
      if (!isPng && filePath.endsWith('.ico')) {
        // Skip raw ICO for Imagine API (PNG/JPEG/WebP only).
        continue
      }
      const b64 = buf.toString('base64')
      // favicon.png-data-uint: PNG bytes as base64 data URI (Uint8Array → base64)
      return `data:image/png;base64,${b64}`
    } catch {
      // try next
    }
  }
  return null
}

export function buildGateArtPromptWithFaviconHint(prompt: string, hasFavicon: boolean): string {
  if (!hasFavicon) return prompt
  if (/<IMAGE_0>|favicon|brand mark|logo motif/i.test(prompt)) return prompt
  return (
    `${prompt.trim()} ` +
    `Use <IMAGE_0> (project favicon) as the brand mark / emblem motif; keep it recognizable.`
  )
}

/** Resolve template imagePrompt placeholders for admin UI / mint. */
export function resolveTemplateArtPrompt(templatePrompt: string): string {
  return interpolateGateArtPrompt(templatePrompt)
}
