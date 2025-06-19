/**
 * Search Widget Custom Element - React 19 Compatible
 * 
 * Embeddable search widget for Ring platform content
 * 
 * Usage:
 * <search-widget 
 *   theme="light|dark" 
 *   placeholder="Search entities..."
 *   search-types="entities,opportunities,news"
 *   max-results="10"
 * ></search-widget>
 */

import { createRoot, Root } from 'react-dom/client'
import React from 'react'

interface SearchWidgetProps {
  theme?: 'light' | 'dark'
  placeholder?: string
  searchTypes?: string
  maxResults?: number
  apiKey?: string
}

interface SearchResult {
  id: string
  title: string
  description: string
  type: 'entity' | 'opportunity' | 'news'
  url: string
  imageUrl?: string
  metadata?: Record<string, any>
}

// React 19 Search Widget Component
function SearchWidgetComponent({ 
  theme = 'light', 
  placeholder = 'Search Ring platform...',
  searchTypes = 'entities,opportunities,news',
  maxResults = 10,
  apiKey 
}: SearchWidgetProps) {
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isOpen, setIsOpen] = React.useState(false)

  const searchTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined)

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&types=${searchTypes}&limit=${maxResults}`,
          {
            headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
          }
        )
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        setResults(data.results || [])
        setIsOpen(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query, searchTypes, maxResults, apiKey])

  const themeClasses = theme === 'dark' 
    ? 'bg-gray-900 text-white border-gray-700' 
    : 'bg-white text-gray-900 border-gray-200'

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'entity': return '🏢'
      case 'opportunity': return '💼'
      case 'news': return '📰'
      default: return '🔍'
    }
  }

  const getTypeColor = (type: string) => {
    const colors = {
      entity: theme === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800',
      opportunity: theme === 'dark' ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800',
      news: theme === 'dark' ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800'
    }
    return colors[type as keyof typeof colors] || (theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')
  }

  const handleResultClick = (result: SearchResult) => {
    window.open(result.url, '_blank')
    setIsOpen(false)
    setQuery('')
  }

  return React.createElement('div', 
    { className: `search-widget relative ${themeClasses}` },
    React.createElement('div', { className: 'relative' },
      React.createElement('input', {
        type: 'text',
        value: query,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
        onFocus: () => query.length >= 2 && setIsOpen(true),
        onBlur: () => setTimeout(() => setIsOpen(false), 200),
        placeholder: placeholder,
        className: `w-full px-4 py-2 pr-10 rounded-lg border ${themeClasses} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`
      }),
      React.createElement('div', { 
        className: 'absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400' 
      }, loading ? '⏳' : '🔍')
    ),
    isOpen && React.createElement('div', { 
      className: `absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-50 ${themeClasses}` 
    },
      error && React.createElement('div', { 
        className: `p-3 text-sm text-red-600 ${theme === 'dark' ? 'bg-red-900' : 'bg-red-50'}` 
      }, error),
      results.length === 0 && !loading && !error && React.createElement('div', { 
        className: 'p-3 text-sm opacity-75 text-center' 
      }, 'No results found'),
      results.length > 0 && React.createElement('div', { className: 'max-h-80 overflow-y-auto' },
        results.map((result, index) =>
          React.createElement('div', {
            key: result.id || index,
            className: `p-3 border-b border-gray-200 last:border-b-0 cursor-pointer hover:bg-gray-50 ${theme === 'dark' ? 'hover:bg-gray-800' : ''} transition-colors`,
            onClick: () => handleResultClick(result)
          },
            React.createElement('div', { className: 'flex items-start space-x-3' },
              result.imageUrl && React.createElement('img', {
                src: result.imageUrl,
                alt: result.title,
                className: 'w-10 h-10 rounded object-cover flex-shrink-0'
              }),
              React.createElement('div', { className: 'flex-1 min-w-0' },
                React.createElement('div', { className: 'flex items-center space-x-2 mb-1' },
                  React.createElement('span', { className: 'text-sm' }, getTypeIcon(result.type)),
                  React.createElement('h4', { className: 'text-sm font-medium truncate' }, result.title),
                  React.createElement('span', { 
                    className: `px-2 py-1 text-xs rounded-full ${getTypeColor(result.type)}` 
                  }, result.type)
                ),
                React.createElement('p', { className: 'text-xs opacity-75 line-clamp-2' }, result.description)
              )
            )
          )
        )
      ),
      results.length > 0 && React.createElement('div', { 
        className: 'p-2 border-t border-gray-200 text-center' 
      },
        React.createElement('a', {
          href: `https://ring.technoring.com/search?q=${encodeURIComponent(query)}`,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-xs text-blue-600 hover:text-blue-800 transition-colors'
        }, `View all results for "${query}" →`)
      )
    )
  )
}

// Custom Element Class - React 19 Compatible
class SearchWidget extends HTMLElement {
  private root: Root | null = null
  private mountPoint: HTMLDivElement | null = null

  static get observedAttributes() {
    return ['theme', 'placeholder', 'search-types', 'max-results', 'api-key']
  }

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.render()
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount()
      this.root = null
    }
  }

  attributeChangedCallback() {
    if (this.root) {
      this.render()
    }
  }

  private getProps(): SearchWidgetProps {
    return {
      theme: (this.getAttribute('theme') as 'light' | 'dark') || 'light',
      placeholder: this.getAttribute('placeholder') || 'Search Ring platform...',
      searchTypes: this.getAttribute('search-types') || 'entities,opportunities,news',
      maxResults: parseInt(this.getAttribute('max-results') || '10'),
      apiKey: this.getAttribute('api-key') || undefined
    }
  }

  private render() {
    if (!this.shadowRoot) return

    // Create mount point if it doesn't exist
    if (!this.mountPoint) {
      this.mountPoint = document.createElement('div')
      
      // Add styles
      const style = document.createElement('style')
      style.textContent = `
        @import url('https://cdn.tailwindcss.com');
        
        .search-widget {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 500px;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .transition-colors {
          transition-property: color, background-color, border-color;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms;
        }
        
        input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
        }
      `
      
      this.shadowRoot.appendChild(style)
      this.shadowRoot.appendChild(this.mountPoint)
    }

    // Create or update React root
    if (!this.root) {
      this.root = createRoot(this.mountPoint)
    }

    // Render React component with current props
    this.root.render(React.createElement(SearchWidgetComponent, this.getProps()))
  }
}

// Register the custom element
if (!customElements.get('search-widget')) {
  customElements.define('search-widget', SearchWidget)
}

export { SearchWidget, SearchWidgetComponent } 