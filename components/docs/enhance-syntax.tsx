'use client'

import { useEffect } from 'react'

export function EnhanceSyntax() {
  useEffect(() => {
    const highlightCode = async () => {
      // Find all code blocks that need syntax highlighting
      const codeBlocks = document.querySelectorAll('pre > code[class*="language-"]:not([data-highlighted])')
      
      if (codeBlocks.length === 0) return
      
      // Dynamically import Shiki only on client side
      const { codeToHtml } = await import('shiki')
      
      for (const codeBlock of codeBlocks) {
        const preElement = codeBlock.parentElement
        if (!preElement) continue
        
        // Mark as processed
        codeBlock.setAttribute('data-highlighted', 'true')
        
        // Get language from class
        const className = codeBlock.className || ''
        const langMatch = className.match(/language-(\w+)/)
        const lang = langMatch ? langMatch[1] : 'text'
        
        // Skip mermaid and mindmap - they're handled separately
        if (lang === 'mermaid' || lang === 'mindmap') continue
        
        try {
          // Get the code text
          const code = codeBlock.textContent || ''
          
          // Generate highlighted HTML
          const html = await codeToHtml(code, {
            lang,
            themes: {
              light: 'github-light',
              dark: 'github-dark',
            },
            defaultColor: false,
          })
          
          // Replace the pre element with highlighted version
          const wrapper = document.createElement('div')
          wrapper.innerHTML = html
          const newPre = wrapper.querySelector('pre')
          if (newPre && preElement.parentNode) {
            // Preserve the original pre's position and attributes
            newPre.setAttribute('data-highlighted', 'true')
            preElement.parentNode.replaceChild(newPre, preElement)
          }
        } catch (error) {
          console.warn(`Failed to highlight ${lang} code block:`, error)
        }
      }
    }
    
    // Run highlighting
    highlightCode()
    
    // Re-run on DOM changes
    const observer = new MutationObserver(() => {
      highlightCode()
    })
    
    observer.observe(document.body, { childList: true, subtree: true })
    
    return () => observer.disconnect()
  }, [])
  
  return null
}
