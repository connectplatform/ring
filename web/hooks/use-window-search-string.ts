'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Query string without `useSearchParams()`.
 * Next.js 16 `useSearchParams()` suspends (dev instrumented `use(promise)`),
 * and a pending chrome island leaves SSR rail HTML without effects —
 * theme / lang / currency / [+] / Login never bind.
 */
export function useWindowSearchString(): string {
  const pathname = usePathname()
  const [search, setSearch] = useState('')

  useEffect(() => {
    const read = () => setSearch(window.location.search.replace(/^\?/, ''))
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [pathname])

  return search
}
