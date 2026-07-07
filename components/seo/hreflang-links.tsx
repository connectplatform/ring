import { generateHreflangAlternates } from '@/lib/seo-metadata'
import { getSiteBaseUrl } from '@/lib/ring-config-core'

// TODO: Use React 19's use client/server hooks for better boundary control if client/server rendering specifics are required in the future.
// TODO: Consider leveraging the Next.js 16 Metadata API if this component is meant for SEO alternates for improved DX and SSR friendliness. See: https://nextjs.org/docs/app/api-reference/functions/generate-metadata

type HreflangLinksProps = {
  /** Path without locale prefix, e.g. `/` or `/about`. */
  pathname: string
}

/**
 * Render HTML <link rel="alternate" hreflang="..." href="..." /> elements for all 
 * language alternate versions of a given path. 
 * Avoids duplicating links in HTTP headers, sidestepping proxy buffer limits.
 */
export function HreflangLinks({ pathname }: HreflangLinksProps) {
  // Get the base site URL (e.g., https://example.com); used for prefixing relative paths.
  const baseUrl = getSiteBaseUrl()

  // Compute the map of { language code: path/url } for this pathname
  // Example result: { en: "/about", de: "https://de.example.com/about" }
  // NOTE: Implementation of generateHreflangAlternates is considered production, not STUB.
  const alternates = generateHreflangAlternates(pathname)

  // Return a React fragment containing <link> tags for each alternate.
  // Each link is keyed by the language code for React reconciliation.
  // If the path is already a full URL (starts with "http"), use as-is.
  // Otherwise, prefix the base URL to create an absolute URL (required for SEO).
  return (
    <>
      {Object.entries(alternates).map(([lang, path]) => {
        // Ensure href is an absolute URI for both relative and absolute paths.
        const href = path.startsWith('http') ? path : `${baseUrl}${path}`
        // Render the alternate link tag for search engines and browsers.
        return (
          <link 
            key={lang} 
            rel="alternate" 
            hrefLang={lang} 
            href={href} 
          />
        )
      })}
    </>
  )
}
