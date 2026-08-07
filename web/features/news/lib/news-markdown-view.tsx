import {
  renderNewsMarkdownToHtml,
  tipContentFormatFromVersions,
} from '@/features/news/lib/render-news-markdown'

type VersionsHint = {
  tipCommitId?: string
  commits?: Array<{ id: string; contentFormat?: string }>
} | null

/**
 * Server-safe news body view: Markdown SSOT → escaped/allowlisted HTML.
 * Replaces sanitizeNewsHtml + dangerouslySetInnerHTML on public article pages.
 */
export function NewsMarkdownView({
  content,
  contentFormat,
  versions,
  className,
}: {
  content: string
  contentFormat?: string | null
  versions?: VersionsHint
  className?: string
}) {
  const format =
    contentFormat ?? tipContentFormatFromVersions(versions ?? undefined)
  const { html } = renderNewsMarkdownToHtml(content || '', {
    contentFormat: format,
  })

  return (
    <div
      className={[
        'news-markdown-body max-w-none space-y-2 text-foreground',
        '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-bold',
        '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-semibold',
        '[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-xl [&_h3]:font-semibold',
        '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6',
        '[&_table]:w-full [&_table]:border-collapse',
        '[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1',
        '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
        '[&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs',
        '[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md',
        '[&_a]:text-primary [&_a]:underline',
        '[&_iframe.ring-embed-iframe]:aspect-video [&_iframe.ring-embed-iframe]:w-full [&_iframe.ring-embed-iframe]:max-w-3xl',
        '[&_video.ring-video]:w-full [&_video.ring-video]:max-w-3xl',
        '[&_ring-embed]:my-4 [&_ring-mood-player]:my-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** One-shot HTML for TOC / reading-time (same pipeline as NewsMarkdownView). */
export function newsBodyHtmlForChrome(
  content: string,
  versions?: VersionsHint,
): string {
  const format = tipContentFormatFromVersions(versions ?? undefined)
  return renderNewsMarkdownToHtml(content || '', { contentFormat: format }).html
}
