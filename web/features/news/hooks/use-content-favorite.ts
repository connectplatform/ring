'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export function useContentFavorite(articleId: string | undefined) {
  const { data: session, status } = useSession()
  const [isFavorited, setIsFavorited] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!articleId || status !== 'authenticated' || !session?.user) {
      setIsFavorited(false)
      return
    }

    let cancelled = false

    async function loadStatus() {
      try {
        const params = new URLSearchParams({
          favoriteType: 'content',
          favoriteId: articleId!,
        })
        const res = await fetch(`/api/user/favorites?${params}`)
        if (!res.ok) return
        const data = (await res.json()) as { favorited?: boolean }
        if (!cancelled) setIsFavorited(Boolean(data.favorited))
      } catch {
        /* ignore */
      }
    }

    void loadStatus()
    return () => {
      cancelled = true
    }
  }, [articleId, session?.user, status])

  const toggleFavorite = useCallback(async (): Promise<boolean> => {
    if (!articleId) return false

    setIsLoading(true)
    try {
      const res = await fetch('/api/user/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favoriteType: 'content', favoriteId: articleId }),
      })
      if (!res.ok) throw new Error('Favorite toggle failed')
      const data = (await res.json()) as { favorited: boolean }
      setIsFavorited(data.favorited)
      return data.favorited
    } finally {
      setIsLoading(false)
    }
  }, [articleId])

  return { isFavorited, isLoading, toggleFavorite }
}
