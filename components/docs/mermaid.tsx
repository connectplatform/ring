'use client'

import React, { useEffect, useRef } from 'react'
import { collectDiagramSource } from '@/components/docs/diagram-source'
import { normalizeMermaidSource, renderMermaidDiagram } from '@/lib/mermaid-render'

export interface MermaidProps {
  children?: React.ReactNode
  /** Optional explicit diagram source (prefer children in MDX). */
  source?: string
  title?: string
  type?: 'diagram' | 'mindmap'
}

function normalizeSvgWidth(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
    const cleaned = attrs
      .replace(/\swidth="[^"]*"/gi, '')
      .replace(/\sheight="[^"]*"/gi, '')
      .replace(/\sstyle="([^"]*)"/gi, '')
    return `<svg${cleaned} width="100%" style="width:100%;height:auto;max-width:100%;display:block">`
  })
}

export function Mermaid({ children, source: sourceProp, title, type = 'diagram' }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = React.useState<string>('')
  const [error, setError] = React.useState<string>('')
  const [isClient, setIsClient] = React.useState(false)
  const [currentTheme, setCurrentTheme] = React.useState<'light' | 'dark'>('light')

  const source = React.useMemo(() => {
    const explicit = typeof sourceProp === 'string' ? sourceProp.trim() : ''
    const fromChildren = collectDiagramSource(children).trim()
    return explicit || fromChildren
  }, [children, sourceProp])

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
        const isDark = currentTheme === 'dark'
        const themeKey = isDark ? 'dark' : 'light'
        const config = {
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
        } as const

        const rendered = await renderMermaidDiagram(source, config, themeKey)
        setSvg(normalizeSvgWidth(rendered))
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

  const showLoading = !svg && !error

  if (error) {
    return (
      <figure className="my-6 w-full">
        {title && <figcaption className="mb-2 font-semibold text-foreground">{title}</figcaption>}
        <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-red-500 dark:text-red-400">Show source</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-red-100 p-2 text-xs dark:bg-red-900/30">
              {normalizeMermaidSource(source)}
            </pre>
          </details>
        </div>
      </figure>
    )
  }

  return (
    <figure className="my-6 w-full min-w-0">
      {title && <figcaption className="mb-2 font-semibold text-foreground">{title}</figcaption>}
      <div className="flex w-full min-h-[12rem] min-w-0 items-center justify-center overflow-x-auto rounded-lg border border-border bg-background p-4 md:p-6">
        {showLoading ? (
          <div
            className="h-40 w-full animate-pulse rounded-md bg-muted"
            aria-busy="true"
            aria-label="Rendering diagram"
          />
        ) : null}
        {svg ? (
          <div
            ref={containerRef}
            className="w-full min-w-0 [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null}
      </div>
    </figure>
  )
}
