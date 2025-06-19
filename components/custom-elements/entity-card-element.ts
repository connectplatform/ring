/**
 * Entity Card Custom Element - React 19 Compatible
 * 
 * Standalone entity card widget for embedding individual entities
 * 
 * Usage:
 * <entity-card 
 *   entity-id="123" 
 *   theme="light|dark" 
 *   show-contact="true"
 *   compact="false"
 * ></entity-card>
 */

import { createRoot, Root } from 'react-dom/client'
import React from 'react'

interface EntityCardProps {
  entityId: string
  theme?: 'light' | 'dark'
  showContact?: boolean
  compact?: boolean
  apiKey?: string
}

interface Entity {
  id: string
  name: string
  description: string
  logoUrl?: string
  website?: string
  email?: string
  phone?: string
  location?: string
  category?: string
}

// React 19 Entity Card Component
function EntityCardComponent({ 
  entityId,
  theme = 'light', 
  showContact = true,
  compact = false,
  apiKey 
}: EntityCardProps) {
  const [entity, setEntity] = React.useState<Entity | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchEntity = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/entities/${entityId}`, {
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        setEntity(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load entity')
      } finally {
        setLoading(false)
      }
    }

    if (entityId) {
      fetchEntity()
    }
  }, [entityId, apiKey])

  const themeClasses = theme === 'dark' 
    ? 'bg-gray-900 text-white border-gray-700' 
    : 'bg-white text-gray-900 border-gray-200'

  if (loading) {
    return React.createElement('div', 
      { className: `entity-card p-4 rounded-lg border ${themeClasses} ${compact ? 'max-w-sm' : 'max-w-md'}` },
      React.createElement('div', { className: 'animate-pulse' },
        React.createElement('div', { className: 'flex items-center space-x-3 mb-3' },
          React.createElement('div', { className: 'w-12 h-12 bg-gray-300 rounded' }),
          React.createElement('div', { className: 'flex-1' },
            React.createElement('div', { className: 'h-4 bg-gray-300 rounded w-3/4 mb-2' }),
            React.createElement('div', { className: 'h-3 bg-gray-300 rounded w-1/2' })
          )
        ),
        !compact && React.createElement('div', { className: 'space-y-2' },
          React.createElement('div', { className: 'h-3 bg-gray-300 rounded' }),
          React.createElement('div', { className: 'h-3 bg-gray-300 rounded w-5/6' })
        )
      )
    )
  }

  if (error || !entity) {
    return React.createElement('div', 
      { className: `entity-card p-4 rounded-lg border border-red-300 ${theme === 'dark' ? 'bg-red-900 text-red-100' : 'bg-red-50 text-red-800'}` },
      React.createElement('p', { className: 'text-sm' }, error || 'Entity not found')
    )
  }

  return React.createElement('div', 
    { className: `entity-card p-4 rounded-lg border ${themeClasses} ${compact ? 'max-w-sm' : 'max-w-md'}` },
    React.createElement('div', { className: 'flex items-start space-x-3 mb-3' },
      entity.logoUrl && React.createElement('img', {
        src: entity.logoUrl,
        alt: entity.name,
        className: compact ? 'w-10 h-10 rounded object-cover' : 'w-12 h-12 rounded object-cover'
      }),
      React.createElement('div', { className: 'flex-1 min-w-0' },
        React.createElement('h3', { 
          className: compact ? 'text-base font-semibold truncate' : 'text-lg font-semibold truncate' 
        }, entity.name),
        entity.category && React.createElement('span', { 
          className: `inline-block px-2 py-1 text-xs rounded-full mt-1 ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}` 
        }, entity.category),
        entity.location && React.createElement('p', { 
          className: 'text-xs opacity-75 mt-1' 
        }, entity.location)
      )
    ),
    !compact && entity.description && React.createElement('p', { 
      className: 'text-sm opacity-90 mb-3 line-clamp-3' 
    }, entity.description),
    showContact && React.createElement('div', { className: 'space-y-2' },
      entity.website && React.createElement('a', {
        href: entity.website,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'block text-sm text-blue-600 hover:text-blue-800 transition-colors'
      }, '🌐 Website'),
      entity.email && React.createElement('a', {
        href: `mailto:${entity.email}`,
        className: 'block text-sm text-blue-600 hover:text-blue-800 transition-colors'
      }, '✉️ Contact'),
      entity.phone && React.createElement('a', {
        href: `tel:${entity.phone}`,
        className: 'block text-sm text-blue-600 hover:text-blue-800 transition-colors'
      }, '📞 Call')
    ),
    React.createElement('div', { className: 'mt-3 pt-3 border-t border-gray-200' },
      React.createElement('a', {
        href: `https://ring.technoring.com/entities/${entity.id}`,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'text-xs text-blue-600 hover:text-blue-800 transition-colors'
      }, 'View on Ring Platform →')
    )
  )
}

// Custom Element Class - React 19 Compatible
class EntityCard extends HTMLElement {
  private root: Root | null = null
  private mountPoint: HTMLDivElement | null = null

  static get observedAttributes() {
    return ['entity-id', 'theme', 'show-contact', 'compact', 'api-key']
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

  private getProps(): EntityCardProps {
    return {
      entityId: this.getAttribute('entity-id') || '',
      theme: (this.getAttribute('theme') as 'light' | 'dark') || 'light',
      showContact: this.getAttribute('show-contact') !== 'false',
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
        
        .entity-card {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
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
    this.root.render(React.createElement(EntityCardComponent, this.getProps()))
  }
}

// Register the custom element
if (!customElements.get('entity-card')) {
  customElements.define('entity-card', EntityCard)
}

export { EntityCard, EntityCardComponent } 