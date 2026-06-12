import { generateHreflangAlternates } from '@/lib/seo-metadata'
import { getSiteBaseUrl } from '@/lib/ring-config'

type HreflangLinksProps = {
  /** Path without locale prefix, e.g. `/` or `/about`. */
  pathname: string
}

/**
 * HTML hreflang alternates only — avoids bloated HTTP `Link` headers from
 * `metadata.alternates.languages` (nginx proxy buffer limits on k3s-or).
 */
export function HreflangLinks({ pathname }: HreflangLinksProps) {
  const baseUrl = getSiteBaseUrl()
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
