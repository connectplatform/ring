/**
 * MDX → agent-facing GFM markdown (AWS/Mintlify-style .md twin).
 * Preserves structure; does NOT use stripMdxForSpeech (that destroys GFM).
 */
import 'server-only'
import { createHash } from 'crypto'
import { resolveDocFilePath } from '@/lib/docs/docs-path'
import { readDocMatter } from '@/lib/docs/docs-article'
import { buildDocsHref, buildDocsMarkdownHref } from '@/lib/docs/docs-path-url'

export type AgentMarkdownResult = {
  markdown: string
  contentHash: string
  title: string
  canonicalPath: string
  markdownPath: string
}

export { buildDocsMarkdownHref }

const AUDIENCE_LABEL: Record<string, string> = {
  founder: 'For founders',
  developer: 'For developers',
  both: 'For founders and developers',
}

function rewriteDocsLinks(md: string): string {
  return md.replace(/\]\(\/docs\/([^)#?\s]+)(\.[^)#?\s]+)?([?#][^)]*)?\)/g, (_full, path, _ext, suffix) => {
    const clean = String(path).replace(/\.mdx?$/i, '').replace(/\/$/, '')
    const hashQuery = suffix ?? ''
    return `](/docs/${clean}.md${hashQuery})`
  })
}

function unwrapJsxChildren(inner: string): string {
  return convertMdxBody(inner.trim())
}

/** Convert known ring-docs JSX widgets; leave GFM intact. */
function convertMdxBody(src: string): string {
  let out = src

  // <Audience for="founder|developer|both">…</Audience>
  out = out.replace(
    /<Audience\s+for=["']([^"']+)["']\s*>\s*([\s\S]*?)\s*<\/Audience>/gi,
    (_m, forAttr: string, inner: string) => {
      const key = forAttr.toLowerCase()
      const label = AUDIENCE_LABEL[key] ?? `For ${forAttr}`
      const body = unwrapJsxChildren(inner)
      return `\n\n### ${label}\n\n${body}\n\n`
    },
  )

  // <Callout type="info|warning|…">…</Callout>
  out = out.replace(
    /<Callout(?:\s+type=["']([^"']+)["'])?\s*>\s*([\s\S]*?)\s*<\/Callout>/gi,
    (_m, typeAttr: string | undefined, inner: string) => {
      const kind = (typeAttr || 'note').toLowerCase()
      const label = kind.charAt(0).toUpperCase() + kind.slice(1)
      const body = unwrapJsxChildren(inner)
        .split('\n')
        .map((line) => (line.trim() ? `> ${line}` : '>'))
        .join('\n')
      return `\n\n> **${label}**\n${body}\n\n`
    },
  )

  // <Card title="…" href="…">…</Card>
  out = out.replace(
    /<Card\s+([^>]*?)>\s*([\s\S]*?)\s*<\/Card>/gi,
    (_m, attrs: string, inner: string) => {
      const title = /title=["']([^"']+)["']/.exec(attrs)?.[1] ?? 'Card'
      const href = /href=["']([^"']+)["']/.exec(attrs)?.[1]
      const body = unwrapJsxChildren(inner).replace(/\s+/g, ' ').trim()
      if (href) {
        return `\n- **[${title}](${href})** — ${body}\n`
      }
      return `\n- **${title}** — ${body}\n`
    },
  )

  // <Cards>…</Cards> — unwrap wrapper
  out = out.replace(/<\/?Cards\s*>/gi, '\n')

  // <RelatedDocs>…</RelatedDocs> / RelatedArticle — keep children
  out = out.replace(/<\/?RelatedDocs\s*>/gi, '\n')
  out = out.replace(
    /<RelatedArticle\s+([^>]*?)\s*\/>/gi,
    (_m, attrs: string) => {
      const slug = /slug=["']([^"']+)["']/.exec(attrs)?.[1]
      const relation = /relation=["']([^"']+)["']/.exec(attrs)?.[1]
      if (!slug) return ''
      const href = `/docs/${slug.replace(/^\/docs\//, '')}`
      return `\n- [${slug}](${href})${relation ? ` — ${relation}` : ''}\n`
    },
  )
  out = out.replace(
    /<RelatedArticle\s+([^>]*?)>\s*([\s\S]*?)\s*<\/RelatedArticle>/gi,
    (_m, attrs: string, inner: string) => {
      const slug = /slug=["']([^"']+)["']/.exec(attrs)?.[1]
      if (!slug) return unwrapJsxChildren(inner)
      const href = `/docs/${slug.replace(/^\/docs\//, '')}`
      return `\n- [${slug}](${href})\n`
    },
  )

  // <Mermaid …>…</Mermaid> → fenced mermaid (strip JSX expression wrappers)
  out = out.replace(
    /<Mermaid([^>]*)>\s*([\s\S]*?)\s*<\/Mermaid>/gi,
    (_m, _attrs: string, inner: string) => {
      let diagram = inner.trim()
      const tpl = /^\{`([\s\S]*?)`\}$/.exec(diagram)
      if (tpl) diagram = tpl[1]!
      return `\n\n\`\`\`mermaid\n${diagram.trim()}\n\`\`\`\n\n`
    },
  )

  // <Steps> / <Step> — unwrap to ordered list-ish prose
  out = out.replace(/<\/?Steps\s*>/gi, '\n')
  out = out.replace(
    /<Step(?:\s+title=["']([^"']+)["'])?\s*>\s*([\s\S]*?)\s*<\/Step>/gi,
    (_m, title: string | undefined, inner: string) => {
      const body = unwrapJsxChildren(inner)
      return title ? `\n#### ${title}\n\n${body}\n\n` : `\n${body}\n\n`
    },
  )

  // Strip remaining JSX/HTML tags but keep text (self-closing + paired)
  out = out.replace(/<([A-Za-z][\w.-]*)(\s[^>]*)?\/>/g, '')
  out = out.replace(/<\/?[A-Za-z][\w.-]*(\s[^>]*)?>/g, '')

  // MDX expression crumbs `{`...`}` left from widgets — drop empty braces lines
  out = out.replace(/^\s*\{\s*\}\s*$/gm, '')

  // Collapse excess blank lines
  out = out.replace(/\n{3,}/g, '\n\n').trim()

  return out
}

/**
 * Build agent markdown for a docs article.
 * @throws if article not found
 */
export function buildAgentMarkdown(locale: string, slug: string[]): AgentMarkdownResult {
  const { filePath } = resolveDocFilePath(locale, slug)
  if (!filePath) {
    throw new Error(`Docs article not found: ${locale}/${slug.join('/') || 'index'}`)
  }
  const matter = readDocMatter(filePath)
  if (!matter) {
    throw new Error(`Docs article unreadable: ${locale}/${slug.join('/') || 'index'}`)
  }

  const title =
    typeof matter.data.title === 'string' && matter.data.title
      ? matter.data.title
      : slug[slug.length - 1] || 'Docs'
  const description =
    typeof matter.data.description === 'string' ? matter.data.description.trim() : ''

  const body = rewriteDocsLinks(convertMdxBody(matter.content))
  const fmLines = ['---', `title: ${JSON.stringify(title)}`]
  if (description) fmLines.push(`description: ${JSON.stringify(description)}`)
  fmLines.push(`locale: ${JSON.stringify(locale)}`)
  fmLines.push('---', '')

  const markdown = `${fmLines.join('\n')}${body.startsWith('#') ? body : `# ${title}\n\n${body}`}\n`
  const contentHash = createHash('sha256').update(matter.content).digest('hex').slice(0, 16)
  const canonicalPath = buildDocsHref(locale, slug)
  const markdownPath = buildDocsMarkdownHref(locale, slug)

  return { markdown, contentHash, title, canonicalPath, markdownPath }
}
