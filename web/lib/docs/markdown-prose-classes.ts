/**
 * Typography SSOT for docs MDX + changelog GFM mods.
 * Do not install @tailwindcss/typography — class tokens + element map (2025-11 / 2026 re-eval).
 */

export const markdownProseClasses = {
  h1: 'text-4xl font-bold tracking-tight mb-6 mt-8 first:mt-0 text-foreground scroll-mt-20',
  h2: 'text-3xl font-semibold tracking-tight mb-4 mt-10 first:mt-0 pb-2 border-b border-border text-foreground scroll-mt-20',
  h3: 'text-2xl font-semibold mb-3 mt-8 text-foreground scroll-mt-20',
  h4: 'text-xl font-semibold mb-2 mt-6 text-foreground scroll-mt-20',
  h5: 'text-lg font-semibold mb-2 mt-4 text-foreground scroll-mt-20',
  h6: 'text-base font-semibold mb-2 mt-4 text-foreground scroll-mt-20',
  p: 'text-base leading-7 text-muted-foreground mb-4 [&:not(:first-child)]:mt-4',
  ul: 'my-4 ml-6 list-disc [&>li]:mt-1 text-muted-foreground',
  ol: 'my-4 ml-6 list-decimal [&>li]:mt-1 text-muted-foreground',
  li: 'leading-5',
  /** Outer scrollport for tables under docs shell overflow-hidden */
  tableWrap: 'my-6 w-full max-w-full min-w-0 overflow-x-auto rounded-lg border border-border',
  table: 'w-full min-w-[32rem] border-collapse text-sm',
  thead: 'bg-muted/50',
  tbody: '[&_tr:last-child]:border-0',
  tr: 'border-b border-border transition-colors hover:bg-muted/40',
  th: 'border border-border px-3 py-2 text-left align-middle font-semibold text-foreground',
  td: 'border border-border px-3 py-2 align-middle text-muted-foreground',
  pre: 'mb-4 mt-4 overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-sm',
  blockquote:
    'mt-6 border-l-4 border-primary pl-6 italic text-muted-foreground [&>p]:text-muted-foreground',
  strong: 'font-semibold text-foreground',
  em: 'italic',
  a: 'text-primary hover:underline font-medium',
  hr: 'my-8 border-gray-200 dark:border-gray-800',
  /** Compact variants for changelog glass cards */
  changelog: {
    h3: 'text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 mt-0',
    h4: 'text-sm font-semibold text-foreground mb-2 mt-3',
    ul: 'my-2 ml-5 list-disc [&>li]:mt-1 text-sm text-muted-foreground',
    ol: 'my-2 ml-5 list-decimal [&>li]:mt-1 text-sm text-muted-foreground',
    li: 'leading-relaxed',
    p: 'text-sm leading-relaxed text-muted-foreground mb-2 [&:not(:first-child)]:mt-2',
    a: 'text-primary hover:underline font-medium',
    strong: 'font-semibold text-foreground',
    code: 'rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground',
    pre: 'my-3 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs',
    tableWrap: 'my-3 w-full max-w-full min-w-0 overflow-x-auto rounded-lg border border-border',
    table: 'w-full min-w-[20rem] border-collapse text-xs',
  },
} as const
