'use client'

import { useMemo } from 'react'
import {
  mapWikiLinksOutsideCode,
  parseWikiLinkInner,
} from '@/features/wiki/wikilink-parser'
import { simpleMarkdownToHtml } from '@/features/wiki/wiki-markdown-codec'
import type { ParsedWikiLink, VaultKey } from '@/features/wiki/types'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function WikiMarkdownPreview({
  markdown,
  vaultKey,
  onNavigate,
}: {
  markdown: string
  vaultKey: VaultKey
  onNavigate?: (link: ParsedWikiLink) => void
}) {
  const html = useMemo(() => {
    const tokens: ParsedWikiLink[] = []
    const stubbed = mapWikiLinksOutsideCode(markdown || '', (_full, inner) => {
      const idx = tokens.length
      tokens.push(parseWikiLinkInner(inner))
      return `%%WIKI${idx}%%`
    })
    let rendered = simpleMarkdownToHtml(stubbed)
    tokens.forEach((link, idx) => {
      const label =
        link.linkKind === 'tenant_ref' ? `@${link.display}` : link.display
      const cls =
        link.linkKind === 'tenant_ref'
          ? 'wiki-link wiki-link-tenant text-primary underline'
          : 'wiki-link wiki-link-local text-primary underline'
      const q =
        link.linkKind === 'tenant_ref'
          ? `vault=tenant&slug=${encodeURIComponent(link.target)}`
          : `vault=${encodeURIComponent(vaultKey)}&slug=${encodeURIComponent(link.target)}`
      const anchor = `<a class="${cls}" href="#wiki?${q}" data-wiki-kind="${link.linkKind}" data-wiki-target="${escapeHtml(link.target)}">${escapeHtml(label)}</a>`
      rendered = rendered.split(`%%WIKI${idx}%%`).join(anchor)
      rendered = rendered.split(escapeHtml(`%%WIKI${idx}%%`)).join(anchor)
    })
    return rendered
  }, [markdown, vaultKey])

  return (
    <div
      className={[
        'wiki-preview max-w-none space-y-2 text-sm leading-relaxed text-foreground',
        '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-bold',
        '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-semibold',
        '[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-xl [&_h3]:font-semibold',
        '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6',
        '[&_table]:w-full [&_table]:border-collapse',
        '[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1',
        '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
        '[&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs',
      ].join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest(
          'a[data-wiki-kind]',
        ) as HTMLAnchorElement | null
        if (!a || !onNavigate) return
        e.preventDefault()
        const kind = a.dataset.wikiKind === 'tenant_ref' ? 'tenant_ref' : 'local'
        const target = a.dataset.wikiTarget || ''
        onNavigate({
          raw: `[[${target}]]`,
          display: a.textContent || target,
          target,
          linkKind: kind,
        })
      }}
    />
  )
}
