/**
 * HTML-only alternate links for crawlers (absolute URLs from hreflang SSOT).
 * HTTP Link hreflang is stripped in proxy-intl where possible; nginx snippets are
 * disabled on k3s-or so proxy-buffer-size remains the edge belt-and-suspenders.
 */
import { toAbsoluteHreflangMap } from '@/lib/hreflang'

type HreflangLinksProps = {
  /** Path without locale prefix, e.g. `/` or `/about`. */
  pathname: string
}

export function HreflangLinks({ pathname }: HreflangLinksProps) {
  const alternates = toAbsoluteHreflangMap(pathname)

  return (
    <>
      {Object.entries(alternates).map(([lang, href]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={href} />
      ))}
    </>
  )
}
