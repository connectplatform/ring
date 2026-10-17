'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { CURTAIN_PAGE_EVENT } from '@/features/curtain/constants'
import type { CurtainPageContextValue } from '@/features/curtain/types'

const CurtainPageContext = createContext<CurtainPageContextValue>({})

export function CurtainPageProvider({
  authorUserId,
  newsArticleId,
  pageKind,
  children,
}: CurtainPageContextValue & { children: ReactNode }) {
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(CURTAIN_PAGE_EVENT, { detail: { authorUserId, newsArticleId, pageKind } }),
    )
    return () => {
      window.dispatchEvent(new CustomEvent(CURTAIN_PAGE_EVENT, { detail: {} }))
    }
  }, [authorUserId, newsArticleId, pageKind])

  return (
    <CurtainPageContext.Provider value={{ authorUserId, newsArticleId, pageKind }}>
      {children}
    </CurtainPageContext.Provider>
  )
}

export function useCurtainPage(): CurtainPageContextValue {
  return useContext(CurtainPageContext)
}
