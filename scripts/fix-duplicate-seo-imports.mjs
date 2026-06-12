#!/usr/bin/env node
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

function fix(content) {
  let c = content
  const ringConfigImport = c.match(/import\s*\{([^}]+)\}\s*from\s*'@\/lib\/ring-config'/)
  const seoImport = c.match(/import\s*\{([^}]+)\}\s*from\s*'@\/lib\/seo-metadata'/)

  if (ringConfigImport && seoImport) {
    const ringNames = new Set(ringConfigImport[1].split(',').map((s) => s.trim()).filter(Boolean))
    const seoParts = seoImport[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !(ringNames.has(s) && (s === 'getSiteBaseUrl' || s === 'getRingSeoBranding')))
    if (seoParts.length === 0) {
      c = c.replace(/import\s*\{[^}]+\}\s*from\s*'@\/lib\/seo-metadata'\n?/, '')
    } else {
      c = c.replace(
        seoImport[0],
        `import { ${seoParts.join(', ')} } from '@/lib/seo-metadata'`,
      )
    }
  }

  // hreflang: only ring-config for getSiteBaseUrl
  if (c.includes("from '@/lib/seo-metadata'") && c.includes("from '@/lib/ring-config'")) {
    c = c.replace(
      /import\s*\{\s*generateHreflangAlternates,\s*getSiteBaseUrl\s*\}\s*from\s*'@\/lib\/seo-metadata'/,
      "import { generateHreflangAlternates } from '@/lib/seo-metadata'",
    )
  }

  return c === content ? null : c
}

let n = 0
for (const file of walk(root)) {
  const raw = fs.readFileSync(file, 'utf8')
  const next = fix(raw)
  if (next) {
    fs.writeFileSync(file, next)
    n++
    console.log('fixed', path.relative(root, file))
  }
}
console.log(`done: ${n}`)
