/**
 * Smoke: unified [locale] layout structure (Phase 0.5).
 * Static filesystem checks — run before manual opp↔store nav QA.
 *
 * Usage: npx tsx scripts/smoke-layout-nav.cts
 */

import fs from 'node:fs'
import path from 'node:path'

const appDir = path.join(process.cwd(), 'app')
let pass = 0
let fail = 0

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function exists(rel: string) {
  return fs.existsSync(path.join(appDir, rel))
}

function main() {
  console.log('smoke-layout-nav (Phase 0.5)')

  ok('unified locale layout', exists('[locale]/layout.tsx'))
  ok('locale app chrome module', fs.existsSync(path.join(process.cwd(), 'components/layout/locale-app-chrome.tsx')))
  ok('protected segment layout', exists('[locale]/(protected)/layout.tsx'))
  ok('admin nested layout', exists('[locale]/admin/layout.tsx'))
  ok('confidential nested layout', exists('[locale]/confidential/layout.tsx'))
  ok('store settings guard', exists('[locale]/store/settings/layout.tsx'))
  ok('roadmap confidential guard', exists('[locale]/docs/roadmap/layout.tsx'))

  ok('old public locale layout removed', !exists('(public)/[locale]/layout.tsx'))
  ok('old authenticated locale layout removed', !exists('(authenticated)/[locale]/layout.tsx'))
  ok('old admin locale layout removed', !exists('(admin)/[locale]/layout.tsx'))
  ok('old confidential locale layout removed', !exists('(confidential)/[locale]/layout.tsx'))

  ok('opportunities under protected', exists('[locale]/(protected)/opportunities/page.tsx'))
  ok('store public page', exists('[locale]/store/page.tsx'))

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main()
