'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Share / save / login handlers from the article wrapper into the header.
 * Do not cloneElement Server Component children (Next.js App Router: that
 * hydrates as an opaque slot and throws — white article body + dead chrome).
 */
export type ArticleHeaderCallbacks = {
  isBookmarked?: boolean
  onShare?: () => void
  onSave?: () => void
  onLoginRequired?: () => void
}

const ArticleHeaderCallbacksContext = createContext<ArticleHeaderCallbacks>({})

export function ArticleHeaderCallbacksProvider({
  value,
  children,
}: {
  value: ArticleHeaderCallbacks
  children: ReactNode
}) {
  return (
    <ArticleHeaderCallbacksContext.Provider value={value}>
      {children}
    </ArticleHeaderCallbacksContext.Provider>
  )
}

export function useArticleHeaderCallbacks(): ArticleHeaderCallbacks {
  return useContext(ArticleHeaderCallbacksContext)
}
