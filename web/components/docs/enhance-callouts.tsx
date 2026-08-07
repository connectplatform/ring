'use client'

import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Callout } from './callout'

export function EnhanceCallouts() {
  useEffect(() => {
    const enhanceCallouts = () => {
      // Remove import statements (they get rendered as paragraphs)
      const allElements = document.querySelectorAll('.markdown-content p, .markdown-content div')
      allElements.forEach((element) => {
        const text = element.textContent || ''
        if (text.trim().startsWith('import { Callout }') || text.trim().startsWith('import {Callout}')) {
          element.remove()
        }
      })

      // Find all <callout> HTML elements (lowercase, as rendered by the browser)
      const calloutElements = document.querySelectorAll('callout')
      
      calloutElements.forEach((calloutElement) => {
        if (calloutElement.hasAttribute('data-callout-rendered')) return
        
        calloutElement.setAttribute('data-callout-rendered', 'true')
        
        // Get the type attribute
        const type = (calloutElement.getAttribute('type') || 'info') as 'info' | 'warning' | 'error' | 'success'
        
        // Get the text content
        const content = calloutElement.textContent || ''
        
        // Create a wrapper div for React rendering
        const wrapper = document.createElement('div')
        calloutElement.parentNode?.replaceChild(wrapper, calloutElement)
        
        // Render the Callout component
        const root = createRoot(wrapper)
        root.render(<Callout type={type}>{content}</Callout>)
      })
    }

    // Run immediately
    enhanceCallouts()
    
    // Watch for new content (for dynamic updates)
    const observer = new MutationObserver(enhanceCallouts)
    observer.observe(document.body, { childList: true, subtree: true })
    
    return () => observer.disconnect()
  }, [])

  return null
}

