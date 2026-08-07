/** Shared Shiki themes for Ring docs — server `<Code>` and legacy rehype parity. */
export const DOCS_SHIKI_THEMES = {
  light: 'nord',
  dark: 'tokyo-night',
} as const

export type DocsShikiTheme = (typeof DOCS_SHIKI_THEMES)[keyof typeof DOCS_SHIKI_THEMES]

/** MDX `language="terminal"` maps to bash for install snippets. */
export function normalizeDocsCodeLanguage(language: string): string {
  const lang = language.trim().toLowerCase()
  if (!lang || lang === 'terminal' || lang === 'shell') return 'bash'
  return lang
}
