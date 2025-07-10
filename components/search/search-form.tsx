'use client'

import React from 'react'
import { useActionState, useTransition, useDeferredValue } from 'react'
import { useFormStatus } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Filter, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from '@/node_modules/react-i18next'
import { searchEntities, SearchFormState } from '@/app/actions/search'

interface SearchFormProps {
  placeholder?: string
  category?: 'entities' | 'opportunities' | 'all'
  onResults?: (results: any[]) => void
  className?: string
}

interface SearchResult {
  id: string
  title: string
  description: string
  type: 'entity' | 'opportunity'
  category?: string
  location?: string
  createdAt: string
}

function SearchButton({ isPending }: { isPending?: boolean }) {
  const { pending } = useFormStatus()
  const { t } = useTranslation()
  
  const isLoading = pending || isPending
  
  return (
    <Button 
      type="submit" 
      size="sm"
      disabled={isLoading}
      className="absolute right-1 top-1 bottom-1 px-3"
    >
      {isLoading ? (
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
        />
      ) : (
        <Search className="h-4 w-4" />
      )}
    </Button>
  )
}

function SearchResults({ results, onClear }: { results: SearchResult[], onClear: () => void }) {
  const { t } = useTranslation()
  
  if (results.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute top-full left-0 right-0 z-50 mt-2"
    >
      <Card className="shadow-lg border border-border/50 backdrop-blur-sm">
        <CardContent className="p-2">
          <div className="flex items-center justify-between px-2 py-1 border-b border-border/30">
            <span className="text-sm font-medium text-muted-foreground">
              {t('searchResults') || 'Search Results'} ({results.length})
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClear}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {results.map((result) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{result.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {result.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {result.type}
                      </Badge>
                      {result.category && (
                        <Badge variant="secondary" className="text-xs">
                          {result.category}
                        </Badge>
                      )}
                      {result.location && (
                        <span className="text-xs text-muted-foreground">
                          📍 {result.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground ml-2">
                    <Clock className="h-3 w-3 mr-1" />
                    {new Date(result.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function RecentSearches({ searches, onSelect }: { searches: string[], onSelect: (search: string) => void }) {
  const { t } = useTranslation()
  
  if (searches.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2"
    >
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {t('recentSearches') || 'Recent searches'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {searches.slice(0, 5).map((search, index) => (
          <button 
            key={index}
            type="button"
            onClick={() => onSelect(search)}
            className="inline-flex"
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
  )
}

/**
 * SearchForm component
 * Real-time search with Server Actions and React 19 concurrent features
 * 
 * React 19 Features:
 * - useActionState() for search state management
 * - useFormStatus() for automatic loading states
 * - useTransition() for non-blocking search operations
 * - useDeferredValue() for optimized rendering during fast typing
 * - Server Actions for search functionality
 * 
 * Performance Features:
 * - Non-blocking UI updates with useTransition
 * - Deferred query processing to prevent excessive re-renders
 * - Optimized search debouncing (300ms)
 * - Real-time search results display
 * - Recent searches storage with localStorage
 * - Automatic loading state management
 * 
 * Benefits:
 * - Responsive UI during heavy search operations
 * - Reduced input lag during fast typing
 * - Better perceived performance
 * - Automatic error handling and recovery
 * 
 * @param {SearchFormProps} props - Component props
 * @returns JSX.Element
 */
export default function SearchForm({ 
  placeholder, 
  category = 'all', 
  onResults, 
  className = '' 
}: SearchFormProps) {
  const { t } = useTranslation()
  const [query, setQuery] = React.useState('')
  const [isActive, setIsActive] = React.useState(false)
  const [recentSearches, setRecentSearches] = React.useState<string[]>([])
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  
  // React 19 Concurrent Features
  const [isPending, startTransition] = useTransition()
  const deferredQuery = useDeferredValue(query)
  
  const [state, formAction] = useActionState<SearchFormState | null, FormData>(
    searchEntities,
    null
  )

  // Load recent searches from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('recent-searches')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to load recent searches:', error)
      }
    }
  }, [])

  // Handle search results
  React.useEffect(() => {
    if (state?.success && state.results) {
      setSearchResults(state.results)
      if (onResults) {
        onResults(state.results)
      }
    }
  }, [state, onResults])

  // React 19: Handle deferred query for optimized rendering
  React.useEffect(() => {
    // Only trigger search when deferred query is different from current query
    // This prevents excessive re-renders during fast typing
    if (deferredQuery !== query && deferredQuery.trim().length >= 2) {
      startTransition(() => {
        const formData = new FormData()
        formData.append('query', deferredQuery)
        formData.append('category', category)
        formAction(formData)
      })
    }
  }, [deferredQuery, query, category, formAction])

  // React 19 Enhanced Search with useTransition
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        // Use startTransition for non-blocking search
        startTransition(() => {
          const formData = new FormData()
          formData.append('query', value)
          formData.append('category', category)
          formAction(formData)
        })
      }, 300)
    } else {
      // Clear results immediately for short queries
      startTransition(() => {
        setSearchResults([])
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim().length < 2) return

    // Save to recent searches
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10)
    setRecentSearches(updated)
    localStorage.setItem('recent-searches', JSON.stringify(updated))

    // Use startTransition for non-blocking form submission
    startTransition(() => {
      const formData = new FormData()
      formData.append('query', query)
      formData.append('category', category)
      formAction(formData)
    })
  }

  const handleRecentSearchSelect = (search: string) => {
    setQuery(search)
    // Use startTransition for non-blocking recent search selection
    startTransition(() => {
      const formData = new FormData()
      formData.append('query', search)
      formData.append('category', category)
      formAction(formData)
    })
  }

  const clearResults = () => {
    setSearchResults([])
    setQuery('')
  }

  return (
    <div className={`relative w-full ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder || t('searchPlaceholder') || 'Search entities, opportunities...'}
            value={query}
            onChange={handleInputChange}
            onFocus={() => setIsActive(true)}
            onBlur={() => setTimeout(() => setIsActive(false), 200)}
            className="pl-10 pr-20 h-10"
            autoComplete="off"
          />
          <div className="absolute right-1 top-1 bottom-1 flex items-center gap-1">
            {query && (
              <Button 
                type="button"
                variant="ghost" 
                size="sm"
                onClick={clearResults}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <SearchButton isPending={isPending} />
          </div>
        </div>

        {/* Filter indicator */}
        {category !== 'all' && (
          <div className="absolute -top-2 right-2">
            <Badge variant="secondary" className="text-xs">
              <Filter className="h-2 w-2 mr-1" />
              {category}
            </Badge>
          </div>
        )}
      </form>

      {/* Search Results or Recent Searches */}
      <AnimatePresence>
        {isActive && (
          <>
            {searchResults.length > 0 ? (
              <SearchResults results={searchResults} onClear={clearResults} />
            ) : query.length === 0 ? (
              <RecentSearches searches={recentSearches} onSelect={handleRecentSearchSelect} />
            ) : null}
          </>
        )}
      </AnimatePresence>

      {/* Error message */}
      {state?.error && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm text-destructive"
        >
          {state.error}
        </motion.div>
      )}
    </div>
  )
} 