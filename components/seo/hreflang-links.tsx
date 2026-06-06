import { generateHreflangAlternates, getSeoSiteBaseUrl } from '@/lib/seo-metadata'

type HreflangLinksProps = {
  /** Path without locale prefix, e.g. `/` or `/about`. */
  pathname: string
}

/**
 * HTML hreflang alternates only — avoids bloated HTTP `Link` headers from
 * `metadata.alternates.languages` (nginx proxy buffer limits on k3s-or).
 */
export function HreflangLinks({ pathname }: HreflangLinksProps) {
  const baseUrl = getSeoSiteBaseUrl()
  const alternates = generateHreflangAlternates(pathname)

  return (
    <>
      {Object.entries(alternates).map(([lang, path]) => {
        const href = path.startsWith('http') ? path : `${baseUrl}${path}`
        return <link key={lang} rel="alternate" hrefLang={lang} href={href} />
      })}
    </>
  )
}
