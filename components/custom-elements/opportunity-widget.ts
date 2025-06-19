/**
 * Opportunity Widget Custom Element - React 19 Compatible
 * 
 * Embeddable opportunity discovery widget
 * 
 * Usage:
 * <opportunity-widget 
 *   theme="light|dark" 
 *   categories="investment,partnership"
 *   max-items="5"
 *   show-amounts="true"
 * ></opportunity-widget>
 */

import { createRoot, Root } from 'react-dom/client'
import React from 'react'

interface OpportunityWidgetProps {
  theme?: 'light' | 'dark'
  categories?: string
  maxItems?: number
  showAmounts?: boolean
  apiKey?: string
}

interface Opportunity {
  id: string
  title: string
  description: string
  category: string
  amount?: number
  currency?: string
  deadline?: string
  entityName?: string
  entityLogo?: string
}

// React 19 Opportunity Widget Component
function OpportunityWidgetComponent({ 
  theme = 'light', 
  categories = '', 
  maxItems = 5,
  showAmounts = true,
  apiKey 
}: OpportunityWidgetProps) {
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        setLoading(true)
        const categoryFilter = categories ? `&categories=${categories}` : ''
        const response = await fetch(
          `/api/opportunities?limit=${maxItems}${categoryFilter}`,
          {
            headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
          }
        )
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        setOpportunities(data.opportunities || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load opportunities')
      } finally {
        setLoading(false)
      }
    }

    fetchOpportunities()
  }, [categories, maxItems, apiKey])

  const themeClasses = theme === 'dark' 
    ? 'bg-gray-900 text-white border-gray-700' 
    : 'bg-white text-gray-900 border-gray-200'

  const formatAmount = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return 'Expired'
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays < 7) return `${diffDays} days left`
    return date.toLocaleDateString()
  }

  if (loading) {
    return React.createElement('div', 
      { className: `opportunity-widget p-4 rounded-lg border ${themeClasses}` },
      React.createElement('div', { className: 'animate-pulse' },
        React.createElement('div', { className: 'h-4 bg-gray-300 rounded w-3/4 mb-3' }),
        Array.from({ length: 3 }, (_, i) =>
          React.createElement('div', { key: i, className: 'mb-3 p-3 border rounded' },
            React.createElement('div', { className: 'h-3 bg-gray-300 rounded w-5/6 mb-2' }),
            React.createElement('div', { className: 'h-3 bg-gray-300 rounded w-1/2' })
          )
        )
      )
    )
  }

  if (error) {
    return React.createElement('div', 
      { className: `opportunity-widget p-4 rounded-lg border border-red-300 ${theme === 'dark' ? 'bg-red-900 text-red-100' : 'bg-red-50 text-red-800'}` },
      React.createElement('p', { className: 'text-sm' }, `Error loading opportunities: ${error}`)
    )
  }

  return React.createElement('div', 
    { className: `opportunity-widget p-4 rounded-lg border ${themeClasses}` },
    React.createElement('div', { className: 'mb-3' },
      React.createElement('h3', { className: 'text-lg font-semibold' }, '💼 Opportunities'),
      React.createElement('p', { className: 'text-sm opacity-75' }, 'Latest investment and partnership opportunities')
    ),
    React.createElement('div', { className: 'space-y-3' },
      opportunities.slice(0, maxItems).map((opportunity, index) =>
        React.createElement('div', {
          key: opportunity.id || index,
          className: `p-3 rounded border ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'} transition-colors cursor-pointer`,
          onClick: () => window.open(`/opportunities/${opportunity.id}`, '_blank')
        },
          React.createElement('div', { className: 'flex items-start justify-between mb-2' },
            React.createElement('div', { className: 'flex-1 min-w-0' },
              React.createElement('h4', { className: 'text-sm font-medium truncate' }, opportunity.title),
              React.createElement('p', { className: 'text-xs opacity-75 mt-1' }, opportunity.entityName || 'Unknown Entity')
            ),
            opportunity.category && React.createElement('span', { 
              className: `ml-2 px-2 py-1 text-xs rounded-full ${theme === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}` 
            }, opportunity.category)
          ),
          React.createElement('p', { className: 'text-xs opacity-90 mb-2 line-clamp-2' }, opportunity.description),
          React.createElement('div', { className: 'flex items-center justify-between text-xs' },
            showAmounts && opportunity.amount && React.createElement('span', { 
              className: 'font-medium text-green-600' 
            }, formatAmount(opportunity.amount, opportunity.currency)),
            opportunity.deadline && React.createElement('span', { 
              className: 'opacity-75' 
            }, formatDeadline(opportunity.deadline))
          )
        )
      )
    ),
    opportunities.length === 0 && React.createElement('div', { 
      className: `text-center py-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}` 
    },
      React.createElement('p', { className: 'text-sm' }, 'No opportunities available')
    ),
    React.createElement('div', { className: 'mt-3 pt-3 border-t border-gray-200' },
      React.createElement('a', {
        href: 'https://ring.technoring.com/opportunities',
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'text-xs text-blue-600 hover:text-blue-800 transition-colors'
      }, 'View all opportunities →')
    )
  )
}

// Custom Element Class - React 19 Compatible
class OpportunityWidget extends HTMLElement {
  private root: Root | null = null
  private mountPoint: HTMLDivElement | null = null

  static get observedAttributes() {
    return ['theme', 'categories', 'max-items', 'show-amounts', 'api-key']
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

  private getProps(): OpportunityWidgetProps {
    return {
      theme: (this.getAttribute('theme') as 'light' | 'dark') || 'light',
      categories: this.getAttribute('categories') || '',
      maxItems: parseInt(this.getAttribute('max-items') || '5'),
      showAmounts: this.getAttribute('show-amounts') !== 'false',
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
        
        .opportunity-widget {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 500px;
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
    this.root.render(React.createElement(OpportunityWidgetComponent, this.getProps()))
  }
}

// Register the custom element
if (!customElements.get('opportunity-widget')) {
  customElements.define('opportunity-widget', OpportunityWidget)
}

export { OpportunityWidget, OpportunityWidgetComponent } 