/**
 * Phase 2 Solana desk + airdrop smoke (config checks, no server-only imports).
 * Run: npx tsx scripts/smoke-phase2-desk.cts
 */
import { readFileSync } from 'fs'
import { join } from 'path'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function main() {
  console.log('Phase 2 smoke — config + fiat credit SSOT')

  const configPath = join(process.cwd(), 'ring-config.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
    tokens?: { creditUnit?: string; desk?: { supplyPolicy?: string } }
  }

  assert(config.tokens?.creditUnit === 'USD', 'tokens.creditUnit must be USD')
  assert(
    config.tokens?.desk?.supplyPolicy === 'treasury_transfer',
    'desk supplyPolicy must be treasury_transfer',
  )

  console.log('OK — Phase 2 static checks passed')
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err)
  process.exit(1)
})
