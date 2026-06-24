'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { usePathname } from '@/i18n/routing'
import { useLocale } from 'next-intl'

type DocsPoolContextValue = {
  /** Locale docs path without leading slash, e.g. `en/architecture/data-model` */
  docPath: string
}

const DocsPoolContext = createContext<DocsPoolContextValue | null>(null)

function deriveDocPath(pathname: string, locale: string): string {
  const normalized = pathname.replace(/\\/g, '/')
  const docsMatch = normalized.match(/\/docs(?:\/(.*))?$/)
  const slugPart = docsMatch?.[1] ?? ''
  return slugPart ? `${locale}/${slugPart}` : `${locale}`
}

export function PublicPoolPathProvider({
  docPath,
  children,
}: {
  docPath: string
  children: React.ReactNode
}) {
  const value = useMemo(() => ({ docPath }), [docPath])
  return <DocsPoolContext.Provider value={value}>{children}</DocsPoolContext.Provider>
}

export function DocsPoolProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const locale = useLocale()

  const value = useMemo(
    () => ({ docPath: deriveDocPath(String(pathname), locale) }),
    [pathname, locale],
  )

  return <DocsPoolContext.Provider value={value}>{children}</DocsPoolContext.Provider>
}

export function useDocsPoolPath(): string {
  const ctx = useContext(DocsPoolContext)
  if (!ctx) {
    return 'en'
  }
  return ctx.docPath
}
