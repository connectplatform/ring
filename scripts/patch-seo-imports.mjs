#!/usr/bin/env node
/**
 * One-shot: migrate RING_PLATFORM_SEO / getSeoSiteBaseUrl → ring-config helpers.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

function patch(content, filePath) {
  if (!content.includes('RING_PLATFORM_SEO') && !content.includes('getSeoSiteBaseUrl')) {
    return null
  }

  let c = content
  const needsBranding =
    c.includes('RING_PLATFORM_SEO') || c.includes('getRingSeoBranding()')
  const needsBaseUrl = c.includes('getSeoSiteBaseUrl') || c.includes('getSiteBaseUrl(')

  c = c.replace(/\n\s*siteName: RING_PLATFORM_SEO\.siteName,\n\s*twitterSite: RING_PLATFORM_SEO\.twitterSite,/g, '')
  c = c.replace(/RING_PLATFORM_SEO\.siteName/g, 'getRingSeoBranding().siteName')
  c = c.replace(/RING_PLATFORM_SEO\.twitterSite/g, 'getRingSeoBranding().twitterSite')
  c = c.replace(/RING_PLATFORM_SEO\.ogImage/g, 'getRingSeoBranding().ogImage')
  c = c.replace(/getSeoSiteBaseUrl/g, 'getSiteBaseUrl')

  // Strip unused RING_PLATFORM_SEO from seo-metadata imports
  c = c.replace(
    /import\s*\{([^}]*)\}\s*from\s*'@\/lib\/seo-metadata'/g,
    (m, inner) => {
      const parts = inner
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== 'RING_PLATFORM_SEO' && s !== 'getSeoSiteBaseUrl')
      if (parts.length === 0) return ''
      return `import { ${parts.join(', ')} } from '@/lib/seo-metadata'`
    },
  )
  c = c.replace(
    /import\s*\{([^}]*)\}\s*from\s*"@\/lib\/seo-metadata"/g,
    (m, inner) => {
      const parts = inner
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== 'RING_PLATFORM_SEO' && s !== 'getSeoSiteBaseUrl')
      if (parts.length === 0) return ''
      return `import { ${parts.join(', ')} } from "@/lib/seo-metadata"`
    },
  )

  // Standalone RING_PLATFORM_SEO import
  c = c.replace(/import\s*\{\s*RING_PLATFORM_SEO\s*\}\s*from\s*['"]@\/lib\/seo-metadata['"];\n?/g, '')

  const rel = path.relative(root, filePath)
  const isLibSeo = rel === 'lib/seo-metadata.ts'

  if (!isLibSeo && (needsBranding || needsBaseUrl)) {
    const imports = []
    if (needsBranding) imports.push('getRingSeoBranding')
    if (needsBaseUrl) imports.push('getSiteBaseUrl')
    const importLine = `import { ${imports.join(', ')} } from '@/lib/ring-config'`
    if (!c.includes("from '@/lib/ring-config'")) {
      const firstImport = c.match(/^import .+$/m)
      if (firstImport) {
        const idx = c.indexOf(firstImport[0]) + firstImport[0].length
        c = `${c.slice(0, idx)}\n${importLine}${c.slice(idx)}`
      } else {
        c = `${importLine}\n${c}`
      }
    }
  }

  return c === content ? null : c
}

const files = walk(root)
let patched = 0
for (const file of files) {
  if (file.endsWith('scripts/patch-seo-imports.mjs')) continue
  const raw = fs.readFileSync(file, 'utf8')
  const next = patch(raw, file)
  if (next) {
    fs.writeFileSync(file, next)
    patched++
    console.log('patched', path.relative(root, file))
  }
}
console.log(`done: ${patched} files`)
