import { createHighlighter, type Highlighter } from 'shiki'
import { DOCS_SHIKI_THEMES, normalizeDocsCodeLanguage } from '@/lib/docs/shiki-config'

const BOOTSTRAP_LANGS = [
  'bash',
  'typescript',
  'tsx',
  'javascript',
  'json',
  'sql',
  'yaml',
  'markdown',
  'text',
  'html',
  'css',
  'python',
  'go',
  'rust',
  'docker',
  'xml',
] as const

let highlighterPromise: Promise<Highlighter> | null = null

async function getDocsHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [DOCS_SHIKI_THEMES.light, DOCS_SHIKI_THEMES.dark],
      langs: [...BOOTSTRAP_LANGS],
    })
  }
  return highlighterPromise
}

async function resolveLanguage(highlighter: Highlighter, language: string): Promise<string> {
  const lang = normalizeDocsCodeLanguage(language)
  if (highlighter.getLoadedLanguages().includes(lang)) {
    return lang
  }
  try {
    await highlighter.loadLanguage(lang as Parameters<Highlighter['loadLanguage']>[0])
    if (highlighter.getLoadedLanguages().includes(lang)) {
      return lang
    }
  } catch {
    // fall through
  }
  return highlighter.getLoadedLanguages().includes('text') ? 'text' : 'bash'
}

/** Single server-side highlight path for MDX `<Code>` and any RSC code blocks. */
export async function highlightCodeToHtml(source: string, language = 'text'): Promise<string> {
  const highlighter = await getDocsHighlighter()
  const lang = await resolveLanguage(highlighter, language)
  return highlighter.codeToHtml(source.trimEnd(), {
    lang,
    themes: DOCS_SHIKI_THEMES,
    defaultColor: false,
  })
}
