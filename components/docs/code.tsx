'use client'

import React, { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

export interface CodeProps {
  children: string
  language?: string
  title?: string
  showLineNumbers?: boolean
}

export function Code({ children, language = 'typescript', title, showLineNumbers = false }: CodeProps) {
  const [html, setHtml] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const highlightCode = async () => {
      try {
        const { codeToHtml } = await import('shiki')
        
        const highlighted = await codeToHtml(children.trim(), {
          lang: language,
          themes: {
            light: 'nord',
            dark: 'tokyo-night',
          },
          defaultColor: false,
        })
        
        setHtml(highlighted)
      } catch (error) {
        console.error('Failed to highlight code:', error)
        // Fallback to plain code
        setHtml(`<pre class="shiki"><code>${children}</code></pre>`)
      }
    }

    highlightCode()
  }, [children, language, isClient])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Show loading state while client-side rendering
  if (!isClient || !html) {
    return (
      <div className="my-6 relative group">
        <div className="flex items-center justify-between mb-2">
          {title && (
            <div className="text-sm font-semibold text-foreground">
              {title}
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-mono px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-muted-foreground border border-gray-200 dark:border-gray-700">
              {language}
            </span>
          </div>
        </div>
        <pre className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {children}
          </code>
        </pre>
      </div>
    )
  }

  return (
    <div className="my-6 relative group">
      {/* Title and Language Label */}
      {/* {(title || language) && (
        <div className="flex items-center justify-between mb-2">
          {title && (
            <div className="text-sm font-semibold text-foreground">
              {title}
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-mono px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-muted-foreground border border-gray-200 dark:border-gray-700">
              {language}
            </span>
          </div>
        </div>
      )} */}

      {/* Code Block with Copy Button */}
      <div className="relative">
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-2 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700 z-10"
          title={copied ? 'Copied!' : 'Copy to clipboard'}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Syntax Highlighted Code - Shiki already has border from CSS */}
        <div 
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}

