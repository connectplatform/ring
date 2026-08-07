/**
 * News Feed Custom Element - React 19 Compatible
 * 
 * Standalone news feed widget for embedding Ring news
 * 
 * Usage:
 * <news-feed 
 *   theme="light|dark" 
 *   max-items="5"
 *   show-images="true"
 *   compact="false"
 * ></news-feed>
 */

import { createRoot, Root } from 'react-dom/client'
import React from 'react'
import { NewsArticle } from '@/features/news/types'

interface NewsFeedProps {
  theme?: 'light' | 'dark'
  maxItems?: number
  showImages?: boolean
  compact?: boolean
  apiKey?: string
}

// React 19 News Feed Component
function NewsFeedComponent({ 
  theme = 'light', 
  maxItems = 5,
  showImages = true,
  compact = false,
  apiKey 
}: NewsFeedProps) {
  const [news, setNews] = React.useState<NewsArticle[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/news?limit=${maxItems}`, {
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        setNews(data.news || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load news')
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [maxItems, apiKey])

  const themeClasses = theme === 'dark' 
    ? 'bg-gray-900 text-white border-gray-700' 
    : 'bg-white text-gray-900 border-gray-200'

  const formatDate = (dateInput: string | { toDate?: () => Date } | any) => {
    let date: Date;
    
    // Handle Firestore Timestamp
    if (dateInput && typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
    } else if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      date = new Date(); // fallback
    }
    
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return React.createElement('div', 
      { className: `news-feed p-4 rounded-lg border ${themeClasses}` },
      React.createElement('div', { className: 'animate-pulse' },
        React.createElement('div', { className: 'h-4 bg-gray-300 rounded w-1/2 mb-3' }),
        Array.from({ length: maxItems }, (_, i) =>
          React.createElement('div', { key: i, className: 'mb-4 pb-4 border-b border-gray-200 last:border-b-0' },
            showImages && !compact && React.createElement('div', { className: 'w-full h-32 bg-gray-300 rounded mb-3' }),
            React.createElement('div', { className: 'h-4 bg-gray-300 rounded w-5/6 mb-2' }),
            React.createElement('div', { className: 'h-3 bg-gray-300 rounded w-4/6 mb-2' }),
            React.createElement('div', { className: 'h-3 bg-gray-300 rounded w-1/3' })
          )
        )
      )
    )
  }

  if (error) {
    return React.createElement('div', 
      { className: `news-feed p-4 rounded-lg border border-red-300 ${theme === 'dark' ? 'bg-red-900 text-red-100' : 'bg-red-50 text-red-800'}` },
      React.createElement('p', { className: 'text-sm' }, `Error loading news: ${error}`)
    )
  }

  return React.createElement('div', 
    { className: `news-feed p-4 rounded-lg border ${themeClasses}` },
    React.createElement('div', { className: 'mb-4' },
      React.createElement('h3', { className: 'text-lg font-semibold' }, '📰 Latest News'),
      React.createElement('p', { className: 'text-sm opacity-75' }, 'Stay updated with Ring platform news')
    ),
    React.createElement('div', { className: 'space-y-4' },
      news.slice(0, maxItems).map((item, index) =>
        React.createElement('article', {
          key: item.id || index,
          className: `pb-4 border-b border-gray-200 last:border-b-0 cursor-pointer hover:opacity-80 transition-opacity`,
          onClick: () => window.open(`/news/${item.slug}`, '_blank')
        },
          showImages && !compact && item.featuredImage && React.createElement('img', {
            src: item.featuredImage,
            alt: item.title,
            className: 'w-full h-32 object-cover rounded mb-3'
          }),
          React.createElement('div', { className: compact ? 'flex items-start space-x-3' : '' },
            showImages && compact && item.featuredImage && React.createElement('img', {
              src: item.featuredImage,
              alt: item.title,
              className: 'w-16 h-16 object-cover rounded flex-shrink-0'
            }),
            React.createElement('div', { className: 'flex-1 min-w-0' },
              React.createElement('h4', { 
                className: compact ? 'text-sm font-medium line-clamp-2 mb-1' : 'text-base font-medium line-clamp-2 mb-2' 
              }, item.title),
              !compact && React.createElement('p', { 
                className: 'text-sm opacity-90 line-clamp-3 mb-2' 
              }, item.excerpt),
              React.createElement('div', { className: 'flex items-center justify-between text-xs opacity-75' },
                React.createElement('div', { className: 'flex items-center space-x-2' },
                  item.authorName && React.createElement('span', {}, item.authorName),
                  item.category && React.createElement('span', { 
                    className: `px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}` 
                  }, item.category)
                ),
                React.createElement('span', {}, formatDate(item.publishedAt))
              )
            )
          )
        )
      )
    ),
    news.length === 0 && React.createElement('div', { 
      className: `text-center py-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}` 
    },
      React.createElement('p', { className: 'text-sm' }, 'No news available')
    ),
    React.createElement('div', { className: 'mt-4 pt-3 border-t border-gray-200' },
      React.createElement('a', {
        href: 'https://ring.ck.ua/news',
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'text-xs text-blue-600 hover:text-blue-800 transition-colors'
      }, 'Read all news →')
    )
  )
}

// Custom Element Class - React 19 Compatible
class NewsFeed extends HTMLElement {
  private root: Root | null = null
  private mountPoint: HTMLDivElement | null = null

  static get observedAttributes() {
    return ['theme', 'max-items', 'show-images', 'compact', 'api-key']
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

  private getProps(): NewsFeedProps {
    return {
      theme: (this.getAttribute('theme') as 'light' | 'dark') || 'light',
      maxItems: parseInt(this.getAttribute('max-items') || '5'),
      showImages: this.getAttribute('show-images') !== 'false',
      compact: this.getAttribute('compact') === 'true',
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
        
        .news-feed {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .transition-opacity {
          transition-property: opacity;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms;
        }
        
        .transition-colors {
          transition-property: color, background-color, border-color;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms;
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
    this.root.render(React.createElement(NewsFeedComponent, this.getProps()))
  }
}

// Register the custom element
if (!customElements.get('news-feed')) {
  customElements.define('news-feed', NewsFeed)
}

export { NewsFeed, NewsFeedComponent } 