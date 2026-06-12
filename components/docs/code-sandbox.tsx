'use client'

import {
  Sandpack,
  SandpackPredefinedTemplate,
  SandpackThemeProp,
} from '@codesandbox/sandpack-react'
import { useEffect, useState } from 'react'

export interface CodeSandboxProps {
  code?: string
  files?: Record<string, string>
  template?: SandpackPredefinedTemplate
  showPreview?: boolean
  title?: string
}

const ringDarkTheme: SandpackThemeProp = {
  colors: {
    surface1: 'hsl(var(--card))',
    surface2: 'hsl(var(--muted))',
    surface3: 'hsl(var(--border))',
    clickable: 'hsl(var(--primary))',
    base: 'hsl(var(--foreground))',
    disabled: 'hsl(var(--muted-foreground))',
    hover: 'hsl(var(--accent))',
    accent: 'hsl(var(--primary))',
    error: 'hsl(var(--destructive))',
    errorSurface: 'hsl(var(--destructive) / 0.15)',
  },
  font: { body: 'var(--font-inter), system-ui, sans-serif', mono: 'ui-monospace, monospace', size: '13px', lineHeight: '1.5' },
}

const ringLightTheme: SandpackThemeProp = ringDarkTheme

export function CodeSandbox({
  code,
  files,
  template = 'react-ts',
  showPreview = true,
  title,
}: CodeSandboxProps) {
  const [theme, setTheme] = useState<SandpackThemeProp>(ringLightTheme)

  useEffect(() => {
    const root = document.documentElement
    const read = () => setTheme(root.classList.contains('dark') ? ringDarkTheme : ringLightTheme)
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const defaultReact = `export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>Ring Platform</h1>
      <p>Edit this sandbox — live preview updates instantly.</p>
    </div>
  )
}`

  const resolvedFiles =
    files ??
    (code
      ? template === 'vanilla-ts' || template === 'vanilla'
        ? { '/index.ts': code }
        : { '/App.tsx': code }
      : { '/App.tsx': defaultReact })

  return (
    <div className="my-8 w-full overflow-hidden rounded-lg border border-border">
      {title ? (
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">{title}</div>
      ) : null}
      <Sandpack
        template={template}
        files={resolvedFiles}
        theme={theme}
        options={{
          showNavigator: false,
          showTabs: Object.keys(resolvedFiles).length > 1,
          showLineNumbers: true,
          editorHeight: 280,
          editorWidthPercentage: showPreview ? 55 : 100,
          activeFile: Object.keys(resolvedFiles)[0],
        }}
      />
    </div>
  )
}
