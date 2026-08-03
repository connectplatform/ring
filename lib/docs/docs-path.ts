/**
 * Docs filesystem resolution under `docs/{locale}/**`.
 *
 * Turbopack NFT: never join `process.cwd()` to a dynamic segment without
 * `/* turbopackIgnore: true *\/` — that traces the whole repo into every
 * Server Component chunk that imports this module. Prefer static `docs`
 * segment after cwd (same pattern as `lib/file/local-storage-root.ts`).
 *
 * Pure slug/URL helpers live in `./docs-path-url` (no fs).
 */

import fs from 'fs'
import path from 'path'
import { SUPPORTED_LOCALES } from '@/lib/locale-config'
import {
  buildDocsHref,
  buildDocsLinkPath,
  normalizeDocsSlug,
  slugFromDocRelativePath,
} from '@/lib/docs/docs-path-url'

export type {
  Locale,
} from '@/lib/docs/docs-path-url'
export {
  buildDocsHref,
  buildDocsLinkPath,
  normalizeDocsSlug,
  slugFromDocRelativePath,
}

export interface DocFilePathResult {
  filePath: string | null
}

export interface DocsSectionMeta {
  title?: string
  description?: string
  pages?: string[]
}

/** Join under project `docs/` without NFT-tracing the repo root. */
export function joinUnderDocs(...segments: string[]): string {
  // Static second segment `docs` scopes NFT; never join(cwd, onlyDynamic).
  const docsRoot = path.join(/* turbopackIgnore: true */ process.cwd(), 'docs')
  if (segments.length === 0) return docsRoot
  return path.join(/* turbopackIgnore: true */ docsRoot, segments.join('/'))
}

/** NFT-safe join when the base is already under `docs/`. */
export function joinDocsFsPath(base: string, ...segments: string[]): string {
  if (segments.length === 0) return base
  return path.join(/* turbopackIgnore: true */ base, segments.join('/'))
}

/** Physical MDX root: `docs/`. */
export function getDocsRoot(docsRoot?: string): string {
  return docsRoot ?? joinUnderDocs()
}

export function getDocsLocaleRoot(locale: string, docsRoot?: string): string {
  if (docsRoot) {
    return joinDocsFsPath(docsRoot, locale)
  }
  // Static `docs` + locale segment — do not path.join(cwd, dynamicOnly)
  return joinUnderDocs(locale)
}

/**
 * Resolves MDX under `docs/{locale}/**`.
 * Contract: try `{slug}.mdx`, then `{slug}/index.mdx`; empty slug → `index.mdx`.
 * URL-shape redirects (`.mdx` suffix, trailing `/index`) live in `next.config.mjs`.
 */
export function resolveDocFilePath(
  locale: string,
  slug: string[],
): DocFilePathResult {
  if (slug.length === 0) {
    return { filePath: joinUnderDocs(locale, 'index.mdx') }
  }

  // Static docs + locale + relative slug path (no cwd+dynamic alone)
  const relative = slug.join('/')
  const directPath = joinUnderDocs(locale, `${relative}.mdx`)
  const hubPath = joinUnderDocs(locale, relative, 'index.mdx')

  if (fs.existsSync(directPath)) {
    return { filePath: directPath }
  }
  if (fs.existsSync(hubPath)) {
    return { filePath: hubPath }
  }

  return { filePath: directPath }
}

export function getDocFilePath(locale: string, slug: string[]): string {
  return resolveDocFilePath(locale, slug).filePath ?? ''
}

export function readSectionMeta(metaPath: string): DocsSectionMeta {
  try {
    if (!fs.existsSync(metaPath)) return {}
    return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as DocsSectionMeta
  } catch {
    return {}
  }
}

export function readLocaleSectionMeta(locale: string, sectionSlug: string): DocsSectionMeta {
  return readSectionMeta(joinUnderDocs(locale, sectionSlug, 'meta.json'))
}

/** Static params for `docs/[[...slug]]` (slug segment only; locale comes from parent). */
export function scanDocsStaticParams(): { slug?: string[] }[] {
  const seen = new Set<string>()
  const params: { slug?: string[] }[] = []

  const add = (slug: string[]) => {
    const key = slug.length === 0 ? '__hub__' : slug.join('/')
    if (seen.has(key)) return
    seen.add(key)
    params.push(slug.length === 0 ? {} : { slug })
  }

  add([])

  for (const locale of SUPPORTED_LOCALES) {
    const localePath = getDocsLocaleRoot(locale)

    const scanDir = (dir: string, currentSlug: string[] = []): void => {
      if (!fs.existsSync(dir)) return

      for (const item of fs.readdirSync(dir)) {
        const fullPath = joinDocsFsPath(dir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          const indexPath = joinDocsFsPath(fullPath, 'index.mdx')
          if (fs.existsSync(indexPath)) {
            add([...currentSlug, item])
          }
          scanDir(fullPath, [...currentSlug, item])
        } else if (item.endsWith('.mdx') && item !== 'index.mdx') {
          add([...currentSlug, item.replace(/\.mdx$/, '')])
        }
      }
    }

    scanDir(localePath)
  }

  return params
}
