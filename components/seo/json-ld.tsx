import Script from 'next/script'
import React from 'react'

interface JsonLdProps {
  /** Unique per page (required when multiple JSON-LD blocks exist). */
  id: string
  data: Record<string, unknown>
}

/**
 * JSON-LD for SEO. Uses `next/script` instead of raw `<script>` so React 19 does not warn
 * when this sits beside client components (e.g. home + HomeWrapper).
 */
export function JsonLd({ id, data }: JsonLdProps) {
  return (
    <Script
      id={id}
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
