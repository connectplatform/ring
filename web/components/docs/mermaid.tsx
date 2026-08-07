'use client'

import React, { useEffect, useRef } from 'react'
import { collectDiagramSource } from '@/components/docs/diagram-source'
import { DiagramViewer } from '@/components/docs/diagram-viewer'
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

/** Mermaid sometimes emits white/near-white strokes under light themes — force slate edges. */
function fixLightModeStrokes(svg: string, isDark: boolean): string {
  if (isDark) return svg
  const visible = '#334155'
  return svg
    .replace(/stroke:\s*#fff(?:fff)?\b/gi, `stroke:${visible}`)
    .replace(/stroke:\s*#f{3,8}\b/gi, `stroke:${visible}`)
    .replace(/stroke:\s*#e[eE]{5}\b/gi, `stroke:${visible}`)
    .replace(/stroke:\s*#f[5-9a-fA-F]{5}\b/gi, `stroke:${visible}`)
    .replace(/stroke:\s*white\b/gi, `stroke:${visible}`)
    .replace(/stroke:\s*rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)/gi, `stroke:${visible}`)
    .replace(/stroke="\s*#fff(?:fff)?\s*"/gi, `stroke="${visible}"`)
    .replace(/stroke="\s*white\s*"/gi, `stroke="${visible}"`)
    .replace(/--mermaid-c-lineColor:\s*#[fFeE][0-9a-fA-F]{5}/g, `--mermaid-c-lineColor:${visible}`)
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
        const themeKey = isDark ? 'dark-base-v2' : 'light-base-v2'
        // `base` honors themeVariables fully; `neutral`/`default` wash out edge strokes in light mode.
        const lightLines = '#334155' // slate-700 — visible on white backgrounds
        const lightBorders = '#64748b' // slate-500
        const darkLines = '#94a3b8' // slate-400
        const darkBorders = '#64748b'
        const config = {
          startOnLoad: false,
          theme: 'base',
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
                primaryTextColor: '#f8fafc',
                primaryBorderColor: darkBorders,
                secondaryColor: '#374151',
                tertiaryColor: '#1f2937',
                mainBkg: '#374151',
                secondBkg: '#1f2937',
                lineColor: darkLines,
                border1: darkBorders,
                border2: darkLines,
                clusterBkg: '#1f2937',
                clusterBorder: darkLines,
                titleColor: '#f8fafc',
                edgeLabelBackground: '#1f2937',
                arrowheadColor: darkLines,
                actorBkg: '#374151',
                actorBorder: darkBorders,
                actorTextColor: '#f8fafc',
                actorLineColor: darkLines,
                signalColor: darkLines,
                signalTextColor: '#f8fafc',
                labelBoxBkgColor: '#374151',
                labelBoxBorderColor: darkBorders,
                labelTextColor: '#f8fafc',
                loopTextColor: '#f8fafc',
                noteBkgColor: '#374151',
                noteTextColor: '#f8fafc',
                noteBorderColor: darkBorders,
                activationBorderColor: darkBorders,
                activationBkgColor: '#4b5563',
                sequenceNumberColor: '#0f172a',
              }
            : {
                background: '#ffffff',
                primaryColor: '#dbeafe',
                primaryTextColor: '#0f172a',
                primaryBorderColor: lightBorders,
                secondaryColor: '#f1f5f9',
                tertiaryColor: '#ffffff',
                mainBkg: '#f8fafc',
                secondBkg: '#ffffff',
                lineColor: lightLines,
                border1: lightBorders,
                border2: lightLines,
                clusterBkg: '#f8fafc',
                clusterBorder: lightLines,
                titleColor: '#0f172a',
                edgeLabelBackground: '#ffffff',
                arrowheadColor: lightLines,
                actorBkg: '#f8fafc',
                actorBorder: lightBorders,
                actorTextColor: '#0f172a',
                actorLineColor: lightLines,
                signalColor: lightLines,
                signalTextColor: '#0f172a',
                labelBoxBkgColor: '#f8fafc',
                labelBoxBorderColor: lightBorders,
                labelTextColor: '#0f172a',
                loopTextColor: '#0f172a',
                noteBkgColor: '#fef9c3',
                noteTextColor: '#0f172a',
                noteBorderColor: lightBorders,
                activationBorderColor: lightBorders,
                activationBkgColor: '#e2e8f0',
                sequenceNumberColor: '#ffffff',
              },
        } as const

        const rendered = await renderMermaidDiagram(source, config as Parameters<typeof renderMermaidDiagram>[1], themeKey)
        setSvg(normalizeSvgWidth(fixLightModeStrokes(rendered, isDark)))
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

  const diagramBody = showLoading ? (
    <div
      className="h-40 w-full animate-pulse rounded-md bg-muted"
      aria-busy="true"
      aria-label="Rendering diagram"
    />
  ) : svg ? (
    <div
      ref={containerRef}
      className="w-full min-w-0 [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:w-full dark:[&_.edgePath_path]:stroke-slate-400 [&_.edgePath_path]:stroke-slate-700 dark:[&_.flowchart-link]:stroke-slate-400 [&_.flowchart-link]:stroke-slate-700 dark:[&_.messageLine0]:stroke-slate-400 [&_.messageLine0]:stroke-slate-700 dark:[&_.messageLine1]:stroke-slate-400 [&_.messageLine1]:stroke-slate-700 dark:[&_.actor-line]:stroke-slate-400 [&_.actor-line]:stroke-slate-700 dark:[&_.cluster_rect]:stroke-slate-400 [&_.cluster_rect]:stroke-slate-700"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  ) : null

  return (
    <DiagramViewer title={title} diagramLabel={type === 'mindmap' ? 'Mind map' : 'Diagram'}>
      {diagramBody}
    </DiagramViewer>
  )
}
