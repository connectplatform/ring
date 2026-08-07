import fs from 'fs'
import path from 'path'
import { cache } from 'react'
import type { Locale } from '@/i18n/shared'
import { defaultLocale } from '@/i18n/shared'
import type { ChangelogDocument, ChangelogEntry } from '@/lib/changelog/types'

function changelogPath(locale: string): string {
  return path.join(process.cwd(), 'docs', locale, 'changelog.json')
}

function isEntry(value: unknown): value is ChangelogEntry {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.date === 'string' &&
    typeof row.version === 'string' &&
    Array.isArray(row.mods) &&
    row.mods.every((m) => typeof m === 'string')
  )
}

function parseChangelogJson(raw: string, filePath: string): ChangelogDocument {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid JSON in ${filePath}`)
  }
  if (!Array.isArray(data)) {
    throw new Error(`changelog.json must be an array: ${filePath}`)
  }
  const entries = data.filter(isEntry)
  if (entries.length !== data.length) {
    throw new Error(`Malformed changelog entries in ${filePath}`)
  }
  return entries
}

function loadChangelogUncached(locale: Locale | string): ChangelogDocument {
  const primary = changelogPath(locale)
  if (fs.existsSync(primary)) {
    return parseChangelogJson(fs.readFileSync(primary, 'utf8'), primary)
  }
  if (locale !== defaultLocale) {
    const fallback = changelogPath(defaultLocale)
    if (fs.existsSync(fallback)) {
      return parseChangelogJson(fs.readFileSync(fallback, 'utf8'), fallback)
    }
  }
  return []
}

/**
 * Load locale changelog rows (append-only JSON). Falls back to default locale.
 * Cached per-request via React `cache()`.
 */
export const loadChangelog = cache(loadChangelogUncached)
