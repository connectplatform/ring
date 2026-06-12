#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'scripts') continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

function prune(content) {
  const m = content.match(/import\s*\{([^}]+)\}\s*from\s*'@\/lib\/ring-config'/)
  if (!m) return null
  const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
  const used = names.filter((n) => {
    const re = new RegExp(`\\b${n}\\b`)
    const body = content.replace(m[0], '')
    return re.test(body)
  })
  if (used.length === names.length) return null
  if (used.length === 0) {
    return content.replace(/import\s*\{[^}]+\}\s*from\s*'@\/lib\/ring-config'\n?/, '')
  }
  return content.replace(m[0], `import { ${used.join(', ')} } from '@/lib/ring-config'`)
}

let n = 0
for (const file of walk(root)) {
  const raw = fs.readFileSync(file, 'utf8')
  const next = prune(raw)
  if (next) {
    fs.writeFileSync(file, next)
    n++
    console.log('pruned', path.relative(root, file))
  }
}
console.log(`done: ${n}`)
