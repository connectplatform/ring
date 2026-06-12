'use client'

import React, { useEffect, useRef } from 'react'
import { collectDiagramSource } from '@/components/docs/diagram-source'

export interface MermaidProps {
  children: React.ReactNode
  title?: string
  type?: 'diagram' | 'mindmap'
}

export function Mermaid({ children, title, type = 'diagram' }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = React.useState<string>('')
  const [error, setError] = React.useState<string>('')
  const [isClient, setIsClient] = React.useState(false)
  const [currentTheme, setCurrentTheme] = React.useState<'light' | 'dark'>('light')

  const source = React.useMemo(() => collectDiagramSource(children).trim(), [children])

  useEffect(() => {
    setIsClient(true)
    setCurrentTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    if (!isClient) return

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark')
          setCurrentTheme(isDark ? 'dark' : 'light')
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [isClient])

  useEffect(() => {
    if (!isClient || !source) {
      setSvg('')
      setError('')
      return
    }

    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        const isDark = currentTheme === 'dark'

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
          mindmap: {
            padding: 10,
            maxNodeWidth: 200,
            useMaxWidth: true,
          },
          themeVariables: isDark
            ? {
                background: '#1f2937',
                primaryColor: '#3b82f6',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#4b5563',
                lineColor: '#6b7280',
                secondaryColor: '#374151',
                tertiaryColor: '#1f2937',
                mainBkg: '#374151',
                secondBkg: '#1f2937',
                border1: '#4b5563',
                border2: '#6b7280',
              }
            : {
                background: '#ffffff',
                primaryColor: '#3b82f6',
                primaryTextColor: '#000000',
                primaryBorderColor: '#d1d5db',
                lineColor: '#6b7280',
                secondaryColor: '#f3f4f6',
                tertiaryColor: '#ffffff',
                mainBkg: '#f3f4f6',
                secondBkg: '#ffffff',
                border1: '#d1d5db',
                border2: '#9ca3af',
              },
        })

        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`
        const { svg: rendered } = await mermaid.render(id, source)
        setSvg(rendered)
        setError('')
      } catch (err: unknown) {
        console.error('Mermaid render error:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram'
        setError(`Diagram syntax error: ${errorMessage}`)
        setSvg('')
      }
    }

    void renderDiagram()
  }, [source, isClient, currentTheme, type])

  if (!source) {
    return null
  }

  if (error) {
    return (
      <div className="my-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        {title && <p className="mb-2 font-semibold text-red-600 dark:text-red-400">{title}</p>}
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-red-500 dark:text-red-400">Show source</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-red-100 p-2 text-xs dark:bg-red-900/30">
            {source}
          </pre>
        </details>
      </div>
    )
  }

  return (
    <div className="my-6">
      {title && <div className="mb-2 font-semibold text-foreground">{title}</div>}
      <div
        ref={containerRef}
        className="flex items-center justify-center overflow-x-auto rounded-lg border border-border bg-background p-6"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}
