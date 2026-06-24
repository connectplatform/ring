'use client'

import React, { useState } from 'react'

export interface InlineCodeProps {
  children: React.ReactNode
}

export function InlineCode({ children }: InlineCodeProps) {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    try {
      const text = typeof children === 'string' ? children : String(children)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <code
      onClick={handleClick}
      className="rounded-sm bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground border border-border cursor-pointer hover:border-primary transition-colors relative group"
      title="Click to copy"
    >
      {children}
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-green-500 text-white text-xs rounded whitespace-nowrap">
          Copied!
        </span>
      )}
    </code>
  )
}

