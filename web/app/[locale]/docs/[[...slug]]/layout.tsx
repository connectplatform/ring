import type { ReactNode } from 'react'

type LayoutProps = {
  children: ReactNode
  params: Promise<{ locale: string; slug?: string[] }>
}

/**
 * Pass-through layout — keep FS out of the layout import graph.
 * Article chrome (`DocsArticleShell`) loads on the page/renderer path only.
 */
export default async function DocsSlugLayout({ children }: LayoutProps) {
  return children
}
