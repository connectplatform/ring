import type { ReactNode } from 'react'
import { DocsPageNav } from '@/components/docs/docs-page-nav'

type LayoutProps = {
  children: ReactNode
  params: Promise<{ locale: string; slug: string[] }>
}

export default async function DocsSlugLayout({ children, params }: LayoutProps) {
  const { slug } = await params

  return (
    <>
      <DocsPageNav slug={slug} showOnDesktop />
      {children}
    </>
  )
}
