'use client'

import React, { useState, useCallback, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { searchOpportunities, SearchOpportunitiesResult } from '@/lib/client-search'
import { useRouter, usePathname } from 'next/navigation'

interface OpportunitiesSearchBarProps {
  placeholder?: string
  className?: string
}

export function OpportunitiesSearchBar({
  placeholder,
  className = ''
}: OpportunitiesSearchBarProps) {
  const t = useTranslations('modules.opportunities')
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const [hasSearched, setHasSearched] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const router = useRouter()
  const pathname = usePathname()

  // Load recent searches from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('opportunities-recent-searches')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to load recent searches:', error)
      }
    }
  }, [])

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      // Clear search parameter and navigate
      const url = new URL(pathname, window.location.origin)
      url.searchParams.delete('q')
      router.push(url.toString())
      setHasSearched(false)
      return
    }

    setHasSearched(true)

    // Update URL with search parameter
    const url = new URL(pathname, window.location.origin)
    url.searchParams.set('q', searchQuery)
    router.push(url.toString())

    // Save to recent searches
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('opportunities-recent-searches', JSON.stringify(updated))
  }, [recentSearches, router, pathname])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(query)
  }

  const handleClear = () => {
    setQuery('')
    setHasSearched(false)
    // Clear search parameter from URL
    const url = new URL(pathname, window.location.origin)
    url.searchParams.delete('q')
    router.push(url.toString())
  }

  const handleRecentSearchSelect = (searchTerm: string) => {
    setQuery(searchTerm)
    handleSearch(searchTerm)
  }

  return (
    <div className={`w-full ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder || t('searchOpportunities') || 'Search opportunities...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-24 h-12 text-base"
            disabled={isPending}
          />
          <div className="absolute right-1 top-1 bottom-1 flex items-center gap-1">
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isPending}
                className="h-10 w-10 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !query.trim()}
              className="h-10 px-4"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Search status indicator */}
        {hasSearched && !isPending && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Badge variant="secondary" className="text-xs">
              {query ? `"${query}"` : 'All opportunities'}
            </Badge>
          </motion.div>
        )}

        {/* Recent searches */}
        <AnimatePresence>
          {!hasSearched && query.length === 0 && recentSearches.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 right-0 z-50 mt-2 bg-background border border-border rounded-lg shadow-lg p-3"
            >
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t('recentSearches') || 'Recent searches'}
              </div>
              <div className="flex flex-wrap gap-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleRecentSearchSelect(search)}
                    className="inline-block"
                  >
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      {search}
                    </Badge>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  )
}
