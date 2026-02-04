'use client'

import React, { useEffect, useRef } from 'react'

interface MermaidDiagramProps {
  chart: string
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = React.useState<string>('')
  const [error, setError] = React.useState<string>('')
  const [isClient, setIsClient] = React.useState(false)

  useEffect(() => {
    // Ensure we're on the client
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    // Dynamically import mermaid only on client side
    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        
        // Check if dark mode is active
        const isDark = document.documentElement.classList.contains('dark')
        
        // Initialize Mermaid with better theme support
        await mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'neutral',
          securityLevel: 'loose',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          flowchart: {
            htmlLabels: true,
            curve: 'basis',
            useMaxWidth: true,
          },
          sequence: {
            diagramMarginX: 50,
            diagramMarginY: 10,
            actorMargin: 50,
            width: 150,
            height: 65,
            boxMargin: 10,
            boxTextMargin: 5,
            noteMargin: 10,
            messageMargin: 35,
            mirrorActors: true,
            useMaxWidth: true,
          },
          themeVariables: isDark ? {
            background: '#1f2937',
            primaryColor: '#3b82f6',
            primaryTextColor: '#ffffff',
            primaryBorderColor: '#4b5563',
            lineColor: '#6b7280',
            secondaryColor: '#374151',
            tertiaryColor: '#1f2937',
          } : {
            background: '#ffffff',
            primaryColor: '#3b82f6',
            primaryTextColor: '#000000',
            primaryBorderColor: '#d1d5db',
            lineColor: '#6b7280',
            secondaryColor: '#f3f4f6',
            tertiaryColor: '#ffffff',
          }
        })

        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`
        try {
          const { svg } = await mermaid.render(id, chart)
          setSvg(svg)
          setError('')
        } catch (renderError: any) {
          console.error('Mermaid render error:', renderError)
          // Try to provide a more helpful error message
          const errorMessage = renderError?.message || 'Failed to render diagram'
          setError(`Diagram syntax error: ${errorMessage}`)
          setSvg('')
        }
      } catch (error) {
        console.error('Failed to render Mermaid diagram:', error)
        setError('Failed to render diagram. Please check the syntax.')
      }
    }

    renderDiagram()
  }, [chart, isClient])

  if (error) {
    return (
      <div className="my-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-red-500 dark:text-red-400">Show source</summary>
          <pre className="mt-2 text-xs overflow-x-auto bg-red-100 dark:bg-red-900/30 p-2 rounded">
            {chart}
          </pre>
        </details>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="my-6 p-6 bg-background rounded-lg border border-border overflow-x-auto flex items-center justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

