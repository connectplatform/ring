/**
 * Parse selected KEY: value pairs from Kubernetes-style YAML (stringData).
 * Supports block scalars (`|`, `|-`, `|+`, `>`) so AUTH_FIREBASE_PRIVATE_KEY
 * is not reported as 1–2 chars (`|` / `|-`).
 */

function indentOf(line) {
  const match = line.match(/^[ \t]*/)
  return match ? match[0].length : 0
}

function unquoteYamlScalar(raw) {
  let value = raw
  const hash = value.search(/\s+#/)
  if (hash >= 0 && !value.startsWith('"') && !value.startsWith("'")) {
    value = value.slice(0, hash)
  }
  value = value.trim()
  if (value.length >= 2) {
    const q = value[0]
    if ((q === '"' || q === "'") && value.endsWith(q)) {
      value = value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"')
    }
  }
  return value
}

/**
 * @param {string} content
 * @param {string[]} keys
 * @returns {Record<string, string>}
 */
export function parseYamlKeyedEnv(content, keys) {
  const env = {}
  const keySet = new Set(keys)
  const lines = content.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedStart = line.trimStart()
    if (!trimmedStart || trimmedStart.startsWith('#')) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue

    const key = line.slice(0, colon).trim()
    if (!keySet.has(key)) continue

    const rest = line.slice(colon + 1).trim()
    const block = rest.match(/^([>|])([+-])?(?:\d+)?$/)

    if (block) {
      const style = block[1]
      const startIndent = indentOf(line)
      const collected = []
      let contentIndent = null
      let j = i + 1
      for (; j < lines.length; j++) {
        const next = lines[j]
        if (next.trim() === '') {
          if (contentIndent !== null) collected.push('')
          continue
        }
        const ind = indentOf(next)
        if (ind <= startIndent) break
        if (contentIndent === null) contentIndent = ind
        if (ind < contentIndent) break
        collected.push(next.slice(contentIndent))
      }
      i = j - 1
      env[key] =
        style === '>'
          ? collected.join(' ').replace(/\s+/g, ' ').trim()
          : collected.join('\n').replace(/\n+$/, '')
      continue
    }

    env[key] = unquoteYamlScalar(rest)
  }

  return env
}
