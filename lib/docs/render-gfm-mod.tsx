import React, { cache } from 'react'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { defaultLocale } from '@/i18n/shared'
import { markdownProseClasses } from '@/lib/docs/markdown-prose-classes'
import { localizeInternalHref } from '@/lib/docs/localize-internal-href'

export { localizeInternalHref } from '@/lib/docs/localize-internal-href'

type GfmComponents = Record<string, React.ComponentType<Record<string, unknown>>>

function changelogGfmComponents(locale: string): GfmComponents {
  const c = markdownProseClasses.changelog
  return {
    h1: (props) => <h3 className={c.h3} {...props} />,
    h2: (props) => <h3 className={c.h3} {...props} />,
    h3: (props) => <h3 className={c.h3} {...props} />,
    h4: (props) => <h4 className={c.h4} {...props} />,
    h5: (props) => <h4 className={c.h4} {...props} />,
    h6: (props) => <h4 className={c.h4} {...props} />,
    p: (props) => <p className={c.p} {...props} />,
    ul: (props) => <ul className={c.ul} {...props} />,
    ol: (props) => <ol className={c.ol} {...props} />,
    li: (props) => <li className={c.li} {...props} />,
    strong: (props) => <strong className={c.strong} {...props} />,
    em: (props) => <em className={markdownProseClasses.em} {...props} />,
    del: (props) => <del className="line-through text-muted-foreground" {...props} />,
    s: (props) => <s className="line-through text-muted-foreground" {...props} />,
    a: ({ href, children, ...props }) => {
      const raw = typeof href === 'string' ? href : undefined
      const resolved = raw ? localizeInternalHref(raw, locale) : undefined
      const external = typeof resolved === 'string' && /^https?:\/\//.test(resolved)
      return (
        <a
          href={resolved}
          className={c.a}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          {...props}
        >
          {children as React.ReactNode}
        </a>
      )
    },
    // Static <code> — do NOT use client InlineCode (hundreds of hydration islands on /changelog)
    code: ({ className, children, ...props }) => {
      const isBlock = typeof className === 'string' && className.includes('language-')
      if (isBlock) {
        return (
          <code className={className} {...props}>
            {children as React.ReactNode}
          </code>
        )
      }
      return (
        <code className={c.code} {...props}>
          {children as React.ReactNode}
        </code>
      )
    },
    pre: (props) => <pre className={c.pre} {...props} />,
    blockquote: (props) => (
      <blockquote className={markdownProseClasses.blockquote} {...props} />
    ),
    hr: (props) => <hr className={markdownProseClasses.hr} {...props} />,
    table: (props) => (
      <div className={c.tableWrap}>
        <table className={c.table} {...props} />
      </div>
    ),
    thead: (props) => <thead className={markdownProseClasses.thead} {...props} />,
    tbody: (props) => <tbody className={markdownProseClasses.tbody} {...props} />,
    tr: (props) => <tr className={markdownProseClasses.tr} {...props} />,
    th: (props) => <th className={markdownProseClasses.th} {...props} />,
    td: (props) => <td className={markdownProseClasses.td} {...props} />,
  }
}

/**
 * Render a changelog mod (GFM markdown) to React elements — no HTML string sink.
 * Supports wiki Preview GFM subset (headings, lists, tables, code, strike, links).
 * Wikilinks `[[…]]` are left as literal text (no vault graph on changelog).
 */
export async function renderGfmMod(
  markdown: string,
  locale: string = defaultLocale,
): Promise<React.ReactElement | null> {
  const source = (markdown || '').trim()
  if (!source) return null

  const processor = remark().use(remarkGfm).use(remarkRehype, { allowDangerousHtml: false })
  const mdast = processor.parse(source)
  const hast = await processor.run(mdast)
  return toJsxRuntime(hast, {
    Fragment,
    jsx,
    jsxs,
    components: changelogGfmComponents(locale),
  }) as React.ReactElement
}

/** Request-memoized loader wrapper — pairs with `loadChangelog` for RSC. */
export const renderGfmModCached = cache(async (markdown: string, locale: string) =>
  renderGfmMod(markdown, locale),
)
