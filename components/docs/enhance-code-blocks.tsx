'use client'

import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MermaidDiagram } from './mermaid-diagram'

export function EnhanceCodeBlocks() {
  useEffect(() => {
    const enhanceCodeBlocks = () => {
      // First, handle Mermaid diagrams and mindmaps (including those not processed by Shiki)
      const diagramBlocks = document.querySelectorAll('pre > code.language-mermaid, pre.language-mermaid > code, pre > code.language-mindmap, pre.language-mindmap > code')
      
      diagramBlocks.forEach((codeElement) => {
        const preElement = codeElement.parentElement
        if (!preElement || preElement.hasAttribute('data-diagram-rendered')) return
        
        // Mark as processed
        preElement.setAttribute('data-diagram-rendered', 'true')
        
        // Get the diagram code
        const diagramCode = codeElement.textContent || ''
        
        // Determine diagram type
        const className = codeElement.className || ''
        const diagramType = className.includes('mindmap') ? 'mindmap' : 'mermaid'
        
        // Create a wrapper div for React rendering
        const wrapper = document.createElement('div')
        wrapper.setAttribute('data-diagram-type', diagramType)
        preElement.parentNode?.replaceChild(wrapper, preElement)
        
        // Render the Mermaid component (handles both mermaid and mindmap)
        const root = createRoot(wrapper)
        root.render(<MermaidDiagram chart={diagramCode} />)
      })
      
      // Then handle code blocks with copy buttons (excluding diagrams)
      const preElements = document.querySelectorAll<HTMLPreElement>('pre.shiki, pre:has(> code[class*="language-"]):not([data-diagram-rendered])')
      
      preElements.forEach((preElement) => {
        if (!preElement || preElement.hasAttribute('data-enhanced')) return
        
        // Find the code element
        const codeElement = preElement.querySelector('code')
        if (!codeElement) return
        
        // Skip if this is a diagram block (mermaid or mindmap)
        if (codeElement.className?.includes('language-mermaid') || codeElement.className?.includes('language-mindmap')) return
        
        // Mark as enhanced
        preElement.setAttribute('data-enhanced', 'true')
        
        // Extract language from code or pre class
        const className = codeElement.className || preElement.className || ''
        const language = className.match(/language-(\w+)/)?.[1] || ''
        
        // Get the code content
        const code = codeElement.textContent || ''
        
        // Style the pre element (only if not already styled by Shiki)
        if (!preElement.classList.contains('shiki')) {
          preElement.style.overflow = 'auto'
          preElement.style.borderRadius = '0.5rem'
          preElement.style.padding = '1rem'
          preElement.style.marginTop = '1.5rem'
          preElement.style.marginBottom = '1.5rem'
        }
        preElement.style.position = 'relative'
        
        // Add language label
        if (language) {
          const languageLabel = document.createElement('div')
          languageLabel.className = 'code-language-label'
          languageLabel.textContent = language
          languageLabel.style.position = 'absolute'
          languageLabel.style.top = '0.5rem'
          languageLabel.style.left = '0.5rem'
          languageLabel.style.fontSize = '0.75rem'
          languageLabel.style.padding = '0.25rem 0.5rem'
          languageLabel.style.borderRadius = '0.25rem'
          languageLabel.style.fontFamily = 'monospace'
          languageLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'
          languageLabel.style.color = 'inherit'
          languageLabel.style.zIndex = '10'
          preElement.appendChild(languageLabel)
        }
        
        // Add copy button
        const copyButton = document.createElement('button')
        copyButton.className = 'code-copy-button'
        copyButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
        `
        copyButton.title = 'Copy to clipboard'
        copyButton.style.position = 'absolute'
        copyButton.style.top = '0.5rem'
        copyButton.style.right = '0.5rem'
        copyButton.style.width = '2rem'
        copyButton.style.height = '2rem'
        copyButton.style.padding = '0'
        copyButton.style.border = '1px solid rgba(0, 0, 0, 0.1)'
        copyButton.style.borderRadius = '0.25rem'
        copyButton.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'
        copyButton.style.cursor = 'pointer'
        copyButton.style.display = 'flex'
        copyButton.style.alignItems = 'center'
        copyButton.style.justifyContent = 'center'
        copyButton.style.opacity = '1'  // Always visible
        copyButton.style.transition = 'all 0.2s'
        copyButton.style.zIndex = '10'

        // Dark mode support
        const updateButtonTheme = () => {
          const isDark = document.documentElement.classList.contains('dark')
          copyButton.style.backgroundColor = isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)'
          copyButton.style.border = isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.2)'
          copyButton.style.color = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.6)'
        }

        updateButtonTheme()

        // Listen for theme changes
        const themeObserver = new MutationObserver(updateButtonTheme)
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class']
        })

        // Hover effects
        copyButton.addEventListener('mouseenter', () => {
          const isDark = document.documentElement.classList.contains('dark')
          copyButton.style.backgroundColor = isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 1)'
        })

        copyButton.addEventListener('mouseleave', () => {
          updateButtonTheme()
        })
        
        // Copy functionality
        copyButton.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(code)
            
            // Visual feedback
            copyButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            `
            copyButton.style.color = '#10b981'
            
            setTimeout(() => {
              copyButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              `
              copyButton.style.color = ''
            }, 2000)
          } catch (err) {
            console.error('Failed to copy:', err)
          }
        })
        
        preElement.appendChild(copyButton)
        
        // Add padding-top to code element to make room for labels/buttons
        if (codeElement instanceof HTMLElement) {
          codeElement.style.display = 'block'
          codeElement.style.paddingTop = '1.5rem'
        }
      })
    }
    
    // Run immediately and on DOM changes
    enhanceCodeBlocks()
    
    // Watch for new code blocks (for dynamic content)
    const observer = new MutationObserver(enhanceCodeBlocks)
    observer.observe(document.body, { childList: true, subtree: true })
    
    return () => observer.disconnect()
  }, [])
  
  return null
}

