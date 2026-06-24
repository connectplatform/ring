import type { ReactNode } from 'react'
import { DocsArticleShell } from '@/components/docs/docs-article-shell'
import { normalizeDocsSlug } from '@/lib/docs/docs-path'

type LayoutProps = {
  children: ReactNode
  params: Promise<{ locale: string; slug?: string[] }>
}

export default async function DocsSlugLayout({ children, params }: LayoutProps) {
  const { locale, slug } = await params

  return (
    <>
      <DocsArticleShell locale={locale} slug={normalizeDocsSlug(slug)} showOnDesktop />
      {children}
    </>
  )
}
