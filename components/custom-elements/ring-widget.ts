/**
 * Ring Widget Custom Element - React 19 Compatible
 * 
 * Embeddable Ring platform widget for external websites
 * Provides entity discovery and opportunity browsing functionality
 * 
 * Usage:
 * <ring-widget 
 *   theme="light|dark" 
 *   locale="en|uk|ru" 
 *   categories="tech,finance,healthcare"
 *   max-items="10"
 * ></ring-widget>
 */

import { createRoot, Root } from 'react-dom/client'
import React from 'react'

interface RingWidgetProps {
  theme?: 'light' | 'dark'
  locale?: 'en' | 'uk' | 'ru'
  categories?: string
  maxItems?: number
  apiKey?: string
}

// React 19 Widget Component
function RingWidgetComponent({ 
  theme = 'light', 
  locale = 'en', 
  categories = '', 
  maxItems = 10,
  apiKey 
}: RingWidgetProps) {
  const [entities, setEntities] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchEntities = async () => {
      try {
        setLoading(true)
        const categoryFilter = categories ? `&categories=${categories}` : ''
        const response = await fetch(
          `/api/entities?limit=${maxItems}&locale=${locale}${categoryFilter}`,
          {
            headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
          }
        )
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        setEntities(data.entities || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load entities')
      } finally {
        setLoading(false)
      }
    }

    fetchEntities()
  }, [categories, maxItems, locale, apiKey])

  const themeClasses = theme === 'dark' 
    ? 'bg-gray-900 text-white border-gray-700' 
    : 'bg-white text-gray-900 border-gray-200'

  if (loading) {
    return React.createElement('div', 
      { className: `ring-widget p-4 rounded-lg border ${themeClasses}` },
      React.createElement('div', { className: 'animate-pulse' },
        React.createElement('div', { className: 'h-4 bg-gray-300 rounded w-3/4 mb-2' }),
        React.createElement('div', { className: 'h-4 bg-gray-300 rounded w-1/2 mb-2' }),
        React.createElement('div', { className: 'h-4 bg-gray-300 rounded w-5/6' })
      )
    )
  }

  if (error) {
    return React.createElement('div', 
      { className: `ring-widget p-4 rounded-lg border border-red-300 ${theme === 'dark' ? 'bg-red-900 text-red-100' : 'bg-red-50 text-red-800'}` },
      React.createElement('p', { className: 'text-sm' }, `Error loading Ring data: ${error}`)
    )
  }

  return React.createElement('div', 
    { className: `ring-widget p-4 rounded-lg border ${themeClasses}` },
    React.createElement('div', { className: 'mb-3' },
      React.createElement('h3', { className: 'text-lg font-semibold' }, 'Ring Platform'),
      React.createElement('p', { className: 'text-sm opacity-75' }, 'Discover entities and opportunities')
    ),
    React.createElement('div', { className: 'space-y-2' },
      entities.slice(0, maxItems).map((entity, index) =>
        React.createElement('div', {
          key: entity.id || index,
          className: `p-3 rounded border ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'} transition-colors cursor-pointer`,
          onClick: () => window.open(`/entities/${entity.id}`, '_blank')
        },
          React.createElement('div', { className: 'flex items-center space-x-3' },
            entity.logoUrl && React.createElement('img', {
              src: entity.logoUrl,
              alt: entity.name,
              className: 'w-8 h-8 rounded object-cover'
            }),
            React.createElement('div', { className: 'flex-1 min-w-0' },
              React.createElement('h4', { className: 'text-sm font-medium truncate' }, entity.name),
              React.createElement('p', { className: 'text-xs opacity-75 truncate' }, entity.description)
            )
          )
        )
      )
    ),
    React.createElement('div', { className: 'mt-3 pt-3 border-t border-gray-200' },
      React.createElement('a', {
        href: 'https://ring.ck.ua',
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'text-xs text-blue-600 hover:text-blue-800 transition-colors'
      }, 'Powered by Ring Platform →')
    )
  )
}

// Custom Element Class - React 19 Compatible
class RingWidget extends HTMLElement {
  private root: Root | null = null
  private mountPoint: HTMLDivElement | null = null

  static get observedAttributes() {
    return ['theme', 'locale', 'categories', 'max-items', 'api-key']
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

  private getProps(): RingWidgetProps {
    return {
      theme: (this.getAttribute('theme') as 'light' | 'dark') || 'light',
      locale: (this.getAttribute('locale') as 'en' | 'uk' | 'ru') || 'en',
      categories: this.getAttribute('categories') || '',
      maxItems: parseInt(this.getAttribute('max-items') || '10'),
      apiKey: this.getAttribute('api-key') || undefined
    }
  }

  private render() {
    if (!this.shadowRoot) return

    // Create mount point if it doesn't exist
    if (!this.mountPoint) {
      this.mountPoint = document.createElement('div')
      
      // Add Tailwind CSS styles
      const style = document.createElement('style')
      style.textContent = `
        @import url('https://cdn.tailwindcss.com');
        
        .ring-widget {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 400px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
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
    this.root.render(React.createElement(RingWidgetComponent, this.getProps()))
  }
}

// Register the custom element
if (!customElements.get('ring-widget')) {
  customElements.define('ring-widget', RingWidget)
}

export { RingWidget, RingWidgetComponent } 