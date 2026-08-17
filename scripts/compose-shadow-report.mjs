#!/usr/bin/env node
/**
 * Dry-run compose-shadow report.
 *
 * Intersection of Layer1 (ring/web) changed paths with L2 pack / L3 overlay
 * owned paths. Does not copy files. Human picks port / delete / lift / leave.
 *
 *   node ring/scripts/compose-shadow-report.mjs
 *   node ring/scripts/compose-shadow-report.mjs --base origin/main --head HEAD
 *   node ring/scripts/compose-shadow-report.mjs --include lib/navigation/primary-nav.ts
 *   RING_COMPOSE_SHADOW_OK=1  → fail only on chrome policy-violation
 *
 * Exit: 0 clean · 1 policy-violation · 2 shadow/locale-key-gap · 3 usage/git
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const {
  listRingCloneSlugs,
  resolveLayer1GitRoot,
  resolveLayer1WebPath,
  resolveCloneGitRoot,
  resolveRingProjectPath,
} = require('../../AI-RINGDOM/lib/resolve-ring-project-path.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** L1-only chrome — must not exist as real files on L3. */
export const CHROME_PATHS = [
  'components/navigation/bottom-navigation.tsx',
  'components/navigation/desktop-sidebar.tsx',
  'components/navigation/sidebar-aside.tsx',
  'components/navigation/sidebar-rail.tsx',
  'components/navigation/sidebar-synced-layout.tsx',
  'lib/navigation/desktop-primary-nav.ts',
]

const SKIP_DIR = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'coverage',
  '.dev-merge',
  '.turbo',
  '.cache',
])

export function flattenKeys(value, prefix = '') {
  if (value === null || value === undefined) {
    return prefix ? [prefix] : []
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }
  const keys = Object.keys(value)
  if (keys.length === 0) {
    return prefix ? [prefix] : []
  }
  return keys.flatMap((k) => {
    const next = prefix ? `${prefix}.${k}` : k
    return flattenKeys(value[k], next)
  })
}

function parseArgs(argv) {
  const out = {
    kingdom: '',
    base: '',
    head: '',
    include: [],
    json: false,
    inventory: false,
    verbose: false,
    includeLegacySiblings: false,
    failOn: new Set(['policy', 'shadow', 'locale']),
    selfTest: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--kingdom') out.kingdom = argv[++i] || ''
    else if (a === '--base') out.base = argv[++i] || ''
    else if (a === '--head') out.head = argv[++i] || ''
    else if (a === '--include') out.include.push(argv[++i] || '')
    else if (a === '--json') out.json = true
    else if (a === '--inventory') out.inventory = true
    else if (a === '--verbose') out.verbose = true
    else if (a === '--include-legacy-siblings') out.includeLegacySiblings = true
    else if (a === '--fail-on') {
      const raw = String(argv[++i] || '')
      out.failOn = new Set(
        raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
    } else if (a === '--self-test') out.selfTest = true
    else if (a === '-h' || a === '--help') out.help = true
    else {
      throw new Error(`Unknown arg: ${a}`)
    }
  }
  if (process.env.RING_COMPOSE_SHADOW_OK) {
    out.failOn = new Set(['policy'])
  }
  return out
}

function git(gitRoot, args, opts = {}) {
  return execFileSync('git', ['-C', gitRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  })
}

function gitOk(gitRoot, args) {
  try {
    git(gitRoot, args)
    return true
  } catch {
    return false
  }
}

function resolveBase(gitRoot, requested) {
  if (requested && gitOk(gitRoot, ['rev-parse', '--verify', requested])) {
    return requested
  }
  for (const cand of ['origin/main', 'github/main', 'main', 'HEAD~1']) {
    if (gitOk(gitRoot, ['rev-parse', '--verify', cand])) return cand
  }
  return 'HEAD'
}

function stripWebPrefix(p) {
  const n = String(p || '').replace(/\\/g, '/')
  if (n === 'web') return ''
  if (n.startsWith('web/')) return n.slice(4)
  return n
}

function parseNameStatus(text) {
  const rows = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    const status = (parts[0] || '').charAt(0)
    if (status === 'R' || status === 'C') {
      const from = stripWebPrefix(parts[1])
      const to = stripWebPrefix(parts[2])
      if (from) rows.push({ status: 'D', path: from })
      if (to) rows.push({ status: status === 'R' ? 'R' : 'A', path: to })
    } else {
      const p = stripWebPrefix(parts[1] || parts[0])
      if (p && p !== status) rows.push({ status, path: p })
    }
  }
  return rows
}

function overlayHasFile(webRoot, rel) {
  if (!webRoot || !rel) return false
  try {
    return fs.existsSync(path.join(webRoot, rel))
  } catch {
    return false
  }
}

function cloneIsUnderRingdomClones(kingdom, slug) {
  return fs.existsSync(path.join(kingdom, 'ringdom-clones', slug))
}

function listComposeCloneSlugs(kingdom, includeLegacySiblings) {
  return listRingCloneSlugs(kingdom).filter(
    (slug) => includeLegacySiblings || cloneIsUnderRingdomClones(kingdom, slug),
  )
}

function listPacks(kingdom) {
  const root = path.join(kingdom, 'ring-presets')
  let names = []
  try {
    names = fs.readdirSync(root)
  } catch {
    return []
  }
  const packs = []
  for (const id of names) {
    const dir = path.join(root, id)
    const web = path.join(dir, 'web')
    if (!fs.existsSync(path.join(dir, 'PACK.json'))) continue
    if (!fs.existsSync(web)) continue
    packs.push({ id, web })
  }
  return packs.sort((a, b) => a.id.localeCompare(b.id))
}

function cloneWebRoot(kingdom, slug) {
  const gitRoot = resolveCloneGitRoot(kingdom, slug)
  const nested = gitRoot && path.join(gitRoot, 'web')
  if (nested && fs.existsSync(nested)) return nested
  const resolved = resolveRingProjectPath(kingdom, slug, { preferWeb: true })
  if (resolved && path.basename(resolved) === 'web') return resolved
  return resolved
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function gitShowJson(gitRoot, rev, webRel) {
  try {
    const raw = git(gitRoot, ['show', `${rev}:web/${webRel}`], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isLocaleJson(rel) {
  return /^locales\/[^/]+\/[^/]+\.json$/.test(rel)
}

function addedLocaleKeys(oldObj, newObj) {
  const oldKeys = new Set(oldObj ? flattenKeys(oldObj) : [])
  const newKeys = flattenKeys(newObj || {})
  return newKeys.filter((k) => !oldKeys.has(k))
}

function walkFiles(dir, base = dir, acc = []) {
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const ent of entries) {
    if (SKIP_DIR.has(ent.name)) continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walkFiles(full, base, acc)
    else if (ent.isFile()) acc.push(path.relative(base, full).replace(/\\/g, '/'))
  }
  return acc
}

function selfTest() {
  const a = flattenKeys({ a: { b: 'x' }, c: 'y' }).sort()
  if (a.join(',') !== 'a.b,c') throw new Error(`flattenKeys failed: ${a}`)
  const added = addedLocaleKeys({ a: '1' }, { a: '1', b: { c: '2' } })
  if (added.join(',') !== 'b.c') throw new Error(`addedLocaleKeys failed: ${added}`)
  console.log('compose-shadow-report self-test ok')
}

function printHelp() {
  console.log(`Usage: node ring/scripts/compose-shadow-report.mjs [options]

  --base REV          git rev to diff against (default: origin/main)
  --head REV          git rev for new tree (default: worktree; use HEAD for push-github-oss)
  --include PATH      extra web-relative path (repeatable)
  --inventory         also report every L2/L3 file that exists on L1
  --include-legacy-siblings  also scan kingdom-root ring-* fat checkouts
  --json              machine JSON on stdout
  --verbose           list all unshadowed paths
  --fail-on LIST      comma: policy,shadow,locale,any  (default: policy,shadow,locale)
  --kingdom PATH      kingdom root (default: parent of ring git)
  --self-test

Env: RING_COMPOSE_SHADOW_OK=1 → fail only on chrome policy-violation.
Does not copy files. Judgment: port | delete | lift | leave.`)
}

function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e.message)
    process.exit(3)
  }
  if (args.help) {
    printHelp()
    process.exit(0)
  }
  if (args.selfTest) {
    selfTest()
    process.exit(0)
  }

  const kingdom =
    args.kingdom ||
    process.env.RINGDOM_ROOT ||
    path.resolve(__dirname, '../..')
  const gitRoot = resolveLayer1GitRoot(kingdom, 'ring')
  const l1Web = resolveLayer1WebPath(kingdom, 'ring')
  if (!gitRoot || !l1Web) {
    console.error('FATAL: Layer1 ring/web not found')
    process.exit(3)
  }

  const base = resolveBase(gitRoot, args.base)
  const head = args.head // empty = worktree
  const packs = listPacks(kingdom)
  const clones = listComposeCloneSlugs(kingdom, args.includeLegacySiblings)

  let diffText = ''
  try {
    const gitArgs = head
      ? ['diff', '--name-status', '--diff-filter=ACDMR', base, head, '--', 'web']
      : ['diff', '--name-status', '--diff-filter=ACDMR', base, '--', 'web']
    diffText = git(gitRoot, gitArgs)
  } catch (e) {
    console.error(`FATAL: git diff failed: ${e.stderr || e.message}`)
    process.exit(3)
  }

  const changed = parseNameStatus(diffText)
  const byPath = new Map()
  for (const row of changed) {
    if (row.path) byPath.set(row.path, row)
  }
  for (const extra of args.include) {
    const rel = stripWebPrefix(extra)
    if (rel && !byPath.has(rel)) byPath.set(rel, { status: 'M', path: rel, included: true })
  }

  if (args.inventory) {
    for (const pack of packs) {
      for (const rel of walkFiles(pack.web)) {
        if (overlayHasFile(l1Web, rel) && !byPath.has(rel)) {
          byPath.set(rel, { status: 'M', path: rel, inventory: true })
        }
      }
    }
    for (const slug of clones) {
      const web = cloneWebRoot(kingdom, slug)
      if (!web) continue
      for (const rel of walkFiles(web)) {
        if (overlayHasFile(l1Web, rel) && !byPath.has(rel)) {
          byPath.set(rel, { status: 'M', path: rel, inventory: true })
        }
      }
    }
  }

  const unshadowed = []
  const l2Only = []
  const l3Only = []
  const both = []
  const localeGaps = []

  for (const row of [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    const rel = row.path
    const l2hits = packs.filter((p) => overlayHasFile(p.web, rel)).map((p) => p.id)
    const l3hits = clones.filter((slug) => overlayHasFile(cloneWebRoot(kingdom, slug), rel))
    const kind =
      l2hits.length && l3hits.length
        ? 'both'
        : l2hits.length
          ? 'l2-shadow'
          : l3hits.length
            ? 'l3-shadow'
            : 'unshadowed'
    const entry = {
      path: rel,
      status: row.status,
      kind,
      packs: l2hits,
      clones: l3hits,
      judgment: 'port | delete | lift | leave',
    }
    if (kind === 'unshadowed') unshadowed.push(entry)
    else if (kind === 'l2-shadow') l2Only.push(entry)
    else if (kind === 'l3-shadow') l3Only.push(entry)
    else both.push(entry)

    if (isLocaleJson(rel) && row.status !== 'D' && l3hits.length) {
      const oldObj = gitShowJson(gitRoot, base, rel)
      const newObj = head
        ? gitShowJson(gitRoot, head, rel)
        : readJsonFile(path.join(l1Web, rel))
      if (!newObj) continue
      const added = addedLocaleKeys(oldObj, newObj)
      if (!added.length) continue
      for (const slug of l3hits) {
        const overlayObj = readJsonFile(path.join(cloneWebRoot(kingdom, slug), rel))
        if (!overlayObj) continue
        const overlayKeys = new Set(flattenKeys(overlayObj))
        const missing = added.filter((k) => !overlayKeys.has(k))
        if (missing.length) {
          localeGaps.push({ path: rel, clone: slug, missing })
        }
      }
    }
  }

  const policy = []
  for (const slug of clones) {
    const web = cloneWebRoot(kingdom, slug)
    if (!web) continue
    for (const rel of CHROME_PATHS) {
      const full = path.join(web, rel)
      try {
        if (fs.existsSync(full) && !fs.lstatSync(full).isSymbolicLink()) {
          policy.push({ clone: slug, path: rel })
        }
      } catch {
        /* ignore */
      }
    }
  }

  const report = {
    tool: 'compose-shadow-report',
    dry_run: true,
    base,
    head: head || 'worktree',
    kingdom,
    packs: packs.map((p) => p.id),
    clones,
    counts: {
      l1_changed: byPath.size,
      unshadowed: unshadowed.length,
      l2_shadow: l2Only.length,
      l3_shadow: l3Only.length,
      both: both.length,
      locale_key_gap: localeGaps.length,
      policy_violation: policy.length,
    },
    unshadowed,
    l2_shadow: l2Only,
    l3_shadow: l3Only,
    both,
    locale_key_gap: localeGaps,
    policy_violation: policy,
    next: 'Human: port | delete | lift | leave. Do not copy L1 onto L2/L3.',
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printHuman(report, args.verbose)
  }

  const failAny = args.failOn.has('any')
  if ((failAny || args.failOn.has('policy')) && policy.length) process.exit(1)
  if ((failAny || args.failOn.has('shadow')) && (l2Only.length || l3Only.length || both.length)) {
    process.exit(2)
  }
  if ((failAny || args.failOn.has('locale')) && localeGaps.length) process.exit(2)
  process.exit(0)
}

function printHuman(report, verbose) {
  console.log('=== compose-shadow report (dry-run) ===')
  console.log(`base: ${report.base}   head: ${report.head}`)
  console.log(
    `L1 changed: ${report.counts.l1_changed}   packs: ${report.packs.join(', ') || '(none)'}`,
  )
  console.log(`clones (ringdom-clones/): ${report.clones.join(', ') || '(none)'}`)
  console.log(
    `unshadowed ${report.counts.unshadowed}  l2-shadow ${report.counts.l2_shadow}  l3-shadow ${report.counts.l3_shadow}  both ${report.counts.both}  locale-key-gap ${report.counts.locale_key_gap}  policy-violation ${report.counts.policy_violation}`,
  )
  const dump = (title, rows, fmt) => {
    if (!rows.length) return
    console.log(`\n${title}:`)
    for (const row of rows) console.log(fmt(row))
  }
  if (verbose || report.unshadowed.length <= 40) {
    dump('unshadowed (compose delivers)', report.unshadowed, (r) => `  ${r.status} ${r.path}`)
  } else {
    console.log(`\nunshadowed (compose delivers): ${report.unshadowed.length} paths — pass --verbose to list`)
  }
  dump(
    'l2-shadow',
    report.l2_shadow,
    (r) => `  ${r.status} ${r.path}\n      pack: ${r.packs.join(', ')}\n      judgment: ${r.judgment}`,
  )
  dump(
    'l3-shadow',
    report.l3_shadow,
    (r) => `  ${r.status} ${r.path}\n      clone: ${r.clones.join(', ')}\n      judgment: ${r.judgment}`,
  )
  dump(
    'both (L2 and L3)',
    report.both,
    (r) =>
      `  ${r.status} ${r.path}\n      pack: ${r.packs.join(', ')}\n      clone: ${r.clones.join(', ')}\n      judgment: ${r.judgment}`,
  )
  dump(
    'locale-key-gap',
    report.locale_key_gap,
    (r) => `  ${r.path}  clone=${r.clone}\n      missing: ${r.missing.join(', ')}`,
  )
  dump(
    'policy-violation (chrome on L3)',
    report.policy_violation,
    (r) => `  ${r.clone}  ${r.path}`,
  )
  console.log(`\n${report.next}`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    main()
  } catch (e) {
    console.error(e.stack || e.message)
    process.exit(3)
  }
}
