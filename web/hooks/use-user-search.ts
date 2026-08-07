'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'
import { useDebounce } from '@/hooks/use-debounce'
import type { UserSearchResult } from '@/features/auth/services/search-users'

export function useUserSearch() {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestTokenRef = useRef(0)

  const debouncedTerm = useDebounce(term, 300)

  const search = useCallback((value: string) => {
    setTerm(value)
  }, [])

  const clear = useCallback(() => {
    requestTokenRef.current += 1
    setTerm('')
    setResults([])
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    const normalized = debouncedTerm.trim()
    if (normalized.length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    const token = ++requestTokenRef.current
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ q: normalized, limit: '8' })
        const response: ApiResponse<UserSearchResult[]> = await apiClient.get(
          `/api/users/search?${params}`,
          { timeout: 8000, retries: 0 },
        )

        if (token !== requestTokenRef.current) return

        if (response.success) {
          setResults(Array.isArray(response.data) ? response.data : [])
        } else {
          throw new Error(response.error || 'Search failed')
        }
      } catch (err) {
        if (token !== requestTokenRef.current) return
        if (err instanceof ApiClientError) {
          setError(err.message)
        } else {
          setError(err instanceof Error ? err.message : 'Search failed')
        }
        setResults([])
      } finally {
        if (token === requestTokenRef.current) {
          setLoading(false)
        }
      }
    }

    void run()
  }, [debouncedTerm])

  return { results, loading, error, search, clear, term }
}
