import fs from 'fs'
import path from 'path'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Root as HastRoot, Element as HastElement } from 'hast'
import { highlightCodeToHtml } from '@/lib/docs/highlight-code'

const CHANGELOG_FILENAME = 'CHANGELOG.md'

export function getChangelogFilePath(): string {
  return path.join(process.cwd(), CHANGELOG_FILENAME)
}

/** Read root `CHANGELOG.md` (repo SSOT for release notes). */
export function readChangelogMarkdown(): string {
  const filePath = getChangelogFilePath()
  if (!fs.existsSync(filePath)) {
    throw new Error(`CHANGELOG.md not found at ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf8')
}

function textFromNode(node: { type?: string; value?: string; children?: unknown[] }): string {
  if (!node) return ''
  if (node.type === 'text' && typeof node.value === 'string') return node.value
  if (Array.isArray(node.children)) {
    return node.children.map((child) => textFromNode(child as { type?: string; value?: string; children?: unknown[] })).join('')
  }
  return ''
}

/** Rehype: replace `<pre><code class="language-*">` with Shiki dual-theme HTML. */
function rehypeShikiCodeBlocks() {
  return async (tree: HastRoot) => {
    const targets: HastElement[] = []
    visit(tree, 'element', (node, _index, parent) => {
      if (
        node.tagName === 'code' &&
        parent &&
        (parent as HastElement).type === 'element' &&
        (parent as HastElement).tagName === 'pre'
      ) {
        targets.push(parent as HastElement)
      }
    })

    await Promise.all(
      targets.map(async (pre) => {
        const code = (pre.children ?? []).find(
          (child): child is HastElement =>
            child.type === 'element' && child.tagName === 'code',
        )
        if (!code) return

        const className = code.properties?.className
        const classes = Array.isArray(className)
          ? className.map(String)
          : typeof className === 'string'
            ? [className]
            : []
        const langClass = classes.find((c) => c.startsWith('language-'))
        const lang = langClass ? langClass.replace(/^language-/, '') : 'text'
        const source = textFromNode(code)
        const html = await highlightCodeToHtml(source, lang)

        pre.tagName = 'div'
        pre.properties = { className: ['changelog-code-block', 'my-4'] }
        pre.children = [{ type: 'raw', value: html }]
      }),
    )
  }
}

/**
 * Render CHANGELOG.md → semantic HTML (headings, lists, bold as article text).
 * Fenced code blocks use shared Shiki highlighter.
 * Returns raw markdown `source` for clipboard copy.
 */
export async function renderChangelogHtml(markdown?: string): Promise<{
  source: string
  html: string
}> {
  const source = markdown ?? readChangelogMarkdown()

  const file = await remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeShikiCodeBlocks)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(source)

  return { source, html: String(file) }
}
