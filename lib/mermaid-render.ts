import type { MermaidConfig } from 'mermaid'

type MermaidModule = typeof import('mermaid')['default']

let mermaidModule: MermaidModule | null = null
let initPromise: Promise<void> | null = null
let lastThemeKey = ''
let renderChain: Promise<unknown> = Promise.resolve()

/** Serialize renders — mindmap parser state is not safe under parallel mermaid.render(). */
function enqueueRender<T>(task: () => Promise<T>): Promise<T> {
  const next = renderChain.then(task, task)
  renderChain = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

async function getMermaid(): Promise<MermaidModule> {
  if (!mermaidModule) {
    mermaidModule = (await import('mermaid')).default
  }
  return mermaidModule
}

/**
 * Mindmap roots with `<br/>` inside `(( ))` break the v11 lexer ("no parent for first child").
 * Child nodes may still use `<br/>`.
 */
export function normalizeMermaidSource(source: string): string {
  const trimmed = source.trim()
  if (!trimmed.toLowerCase().startsWith('mindmap')) {
    return trimmed
  }

  const lines = trimmed.split('\n')
  const normalized = lines.map((line, index) => {
    if (index === 0) return line
    if (!/^\s*root\s*\(\(/i.test(line)) return line
    return line.replace(/<br\s*\/?>/gi, ' — ')
  })

  return normalized.join('\n')
}

export async function ensureMermaidInitialized(config: MermaidConfig, themeKey: string): Promise<MermaidModule> {
  const mermaid = await getMermaid()
  if (initPromise && lastThemeKey === themeKey) {
    await initPromise
    return mermaid
  }

  lastThemeKey = themeKey
  initPromise = Promise.resolve(mermaid.initialize(config))
  await initPromise
  return mermaid
}

export async function renderMermaidDiagram(
  source: string,
  config: MermaidConfig,
  themeKey: string,
): Promise<string> {
  const normalized = normalizeMermaidSource(source)

  return enqueueRender(async () => {
    const mermaid = await ensureMermaidInitialized(config, themeKey)
    const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`

    // Mindmap is lazy-loaded; parse() ensures the diagram module is registered before render.
    if (normalized.toLowerCase().startsWith('mindmap')) {
      await mermaid.parse(normalized)
    }

    const { svg } = await mermaid.render(id, normalized)
    return svg
  })
}
