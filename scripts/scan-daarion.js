#!/usr/bin/env node
/*
 Simple scanner to map Daarion legacy project structure.
 Usage: node scripts/scan-daarion.js /path/to/daarion > integrations/daarion/module-map.json
*/
const fs = require('fs')
const path = require('path')

function walk(dir, patterns = [/wallet/i, /stake/i, /nft/i, /market/i, /store/i]) {
  const results = []
  ;(function recur(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) recur(p)
      else if (/\.(ts|tsx|js|json)$/.test(e.name)) {
        const rel = p
        const lower = rel.toLowerCase()
        const tags = patterns.filter(rx => rx.test(lower)).map(rx => rx.source)
        results.push({ file: rel, tags })
      }
    }
  })(dir)
  return results
}

const target = process.argv[2]
if (!target) {
  console.error('Usage: node scripts/scan-daarion.js /path/to/daarion')
  process.exit(1)
}
const map = walk(target)
console.log(JSON.stringify({ scannedAt: new Date().toISOString(), base: path.resolve(target), files: map }, null, 2))
