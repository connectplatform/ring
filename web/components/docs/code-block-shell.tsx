'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { normalizeDocsCodeLanguage } from '@/lib/docs/shiki-config'

export interface CodeBlockShellProps {
  source: string
  html: string
  language?: string
  title?: string
}

/**
 * Client shell for highlighted code — copy UI only. Shiki runs on the server via `highlightCodeToHtml`.
 */
export function CodeBlockShell({
  source,
  html,
  language = 'text',
  title,
}: CodeBlockShellProps) {
  const [copied, setCopied] = useState(false)
  const label = normalizeDocsCodeLanguage(language)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="my-6 relative group">
      {(title || label) && (
        <div className="flex items-center justify-between mb-2">
          {title ? <div className="text-sm font-semibold text-foreground">{title}</div> : <span />}
          <span className="text-xs font-mono px-2 py-1 rounded bg-muted text-muted-foreground border border-border ml-auto">
            {label}
          </span>
        </div>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-3 right-3 p-2 rounded-md bg-muted border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/80 z-10"
          title={copied ? 'Copied!' : 'Copy to clipboard'}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <div
          className="docs-code-block overflow-x-auto rounded-lg border border-border [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
