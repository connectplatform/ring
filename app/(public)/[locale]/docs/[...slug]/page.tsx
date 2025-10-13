import React from 'react'
import { remark } from 'remark'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { MarkdownRenderer } from '@/components/docs/markdown-renderer'
import { EnhanceCodeBlocks } from '@/components/docs/enhance-code-blocks'
import { EnhanceCallouts } from '@/components/docs/enhance-callouts'
import { EnhanceSyntax } from '@/components/docs/enhance-syntax'
import DesktopSidebar from '@/features/layout/components/desktop-sidebar'
import RightSidebar from '@/features/layout/components/right-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import DocsNavigationTree from '../docs-navigation-tree'
import { notFound } from 'next/navigation'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import remarkGfm from 'remark-gfm'

// MDX components
const components = {
  h1: ({ children, ...props }: any) => (
    <h1 className="text-3xl font-bold mb-6" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-2xl font-bold mb-4 mt-8" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-xl font-semibold mb-3 mt-6" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: any) => (
    <p className="mb-4 text-gray-700 dark:text-gray-300" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="mb-4 ml-6 list-disc text-gray-700 dark:text-gray-300" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="mb-4 ml-6 list-decimal text-gray-700 dark:text-gray-300" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="mb-1" {...props}>{children}</li>
  ),
  code: ({ children, className, ...props }: any) => {
    const isInline = !className?.includes('language-')
    return isInline ? (
      <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    ) : (
      <code className={className} {...props}>{children}</code>
    )
  },
  pre: ({ children, ...props }: any) => (
    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4" {...props}>
      {children}
    </pre>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-4 border-blue-500 pl-4 italic mb-4 text-gray-600 dark:text-gray-400" {...props}>
      {children}
    </blockquote>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-semibold" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: any) => (
    <em className="italic" {...props}>{children}</em>
  ),
  Callout: ({ children, type = 'info', ...props }: any) => {
    const getCalloutStyles = (type: string) => {
      switch (type) {
        case 'warning':
          return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
        case 'error':
          return 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        case 'success':
          return 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
        case 'info':
        default:
          return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
      }
    }

    const getIcon = (type: string) => {
      switch (type) {
        case 'warning':
          return '⚠️'
        case 'error':
          return '❌'
        case 'success':
          return '✅'
        case 'info':
        default:
          return 'ℹ️'
      }
    }

    return (
      <div className={`border-l-4 p-4 my-4 rounded-r-md ${getCalloutStyles(type)}`} {...props}>
        <div className="flex items-start">
          <span className="mr-2 text-lg">{getIcon(type)}</span>
          <div className="flex-1">{children}</div>
        </div>
      </div>
    )
  },
}

interface PageProps {
  params: Promise<{
    locale: string
    slug: string[]
  }>
}

export default async function DocPage({ params }: PageProps) {
  const { locale, slug } = await params

  // Build the file path for the MDX file
  const docsRoot = path.join(process.cwd(), 'docs', 'content')
  let filePath: string

  // Handle different slug patterns
  if (slug.length === 1 && slug[0] === 'library') {
    // Special case: 'library' maps to 'library/index.mdx' (the comprehensive docs index)
    filePath = path.join(docsRoot, locale, 'library', 'index.mdx')
  } else if (slug.length === 1) {
    // Single segment: e.g., 'getting-started' -> 'library/getting-started/index.mdx'
    filePath = path.join(docsRoot, locale, 'library', slug[0], 'index.mdx')
  } else {
    // Multi-segment: e.g., 'getting-started', 'installation' -> 'library/getting-started/installation.mdx'
    filePath = path.join(docsRoot, locale, 'library', ...slug) + '.mdx'
  }

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Doc file not found: ${filePath}`)
      notFound()
    }

    // Read the MDX file
    const fileContents = fs.readFileSync(filePath, 'utf8')

    // Parse frontmatter
    const { data, content } = matter(fileContents)

    // Convert markdown to HTML WITHOUT syntax highlighting (will be done client-side)
    // This prevents server-side timeouts
    const processedContent = await remark()
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(content)
    
    const contentHtml = processedContent.toString()

    return (
      <div className="min-h-screen bg-background">
        {/* Desktop Layout - Three columns, hidden on mobile and iPad */}
        <div className="hidden lg:grid gap-6 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <div>
            <DesktopSidebar />
          </div>

          {/* Main Content - Documentation */}
          <div className="px-4 py-8">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-4">{data.title || 'Documentation'}</h1>
                {data.description && (
                  <p className="text-xl text-muted-foreground">{data.description}</p>
                )}
              </div>

              {/* Content */}
              <MarkdownRenderer htmlContent={contentHtml} />
              <EnhanceSyntax />
              <EnhanceCodeBlocks />
              <EnhanceCallouts />
          </div>

          {/* Right Sidebar - Documentation Navigation */}
          <div>
            <RightSidebar title="Documentation">
              <DocsNavigationTree locale={locale} />
            </RightSidebar>
          </div>
        </div>

        {/* iPad Layout - Two columns (sidebar + content), hidden on mobile and desktop */}
        <div className="hidden md:grid md:grid-cols-[280px_1fr] lg:hidden gap-6 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <div>
            <DesktopSidebar />
          </div>

          {/* Main Content - Documentation */}
          <div className="px-4 py-8 relative">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-4">{data.title || 'Documentation'}</h1>
                {data.description && (
                  <p className="text-xl text-muted-foreground">{data.description}</p>
                )}
              </div>

              {/* Content */}
              <MarkdownRenderer htmlContent={contentHtml} />
              <EnhanceSyntax />
              <EnhanceCodeBlocks />
              <EnhanceCallouts />

            {/* Floating Sidebar Toggle for Documentation Navigation */}
            <FloatingSidebarToggle>
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Documentation</h3>
                <DocsNavigationTree locale={locale} />
              </div>
            </FloatingSidebarToggle>
          </div>
        </div>

        {/* Mobile Layout - Single column, hidden on iPad and desktop */}
        <div className="md:hidden px-4 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-4">{data.title || 'Documentation'}</h1>
              {data.description && (
                <p className="text-lg text-muted-foreground">{data.description}</p>
              )}
            </div>

            {/* Content */}
            <MarkdownRenderer htmlContent={contentHtml} />
            <EnhanceSyntax />
            <EnhanceCodeBlocks />
            <EnhanceCallouts />

          {/* Floating Sidebar Toggle for Documentation Navigation */}
          <FloatingSidebarToggle>
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Documentation</h3>
              <DocsNavigationTree locale={locale} />
            </div>
          </FloatingSidebarToggle>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading doc:', error)
    notFound()
  }
}

// Generate static params for all docs
export async function generateStaticParams() {
  const docsRoot = path.join(process.cwd(), 'docs', 'content')
  const locales = ['en', 'ru', 'uk']
  const params: { locale: string; slug: string[] }[] = []

  for (const locale of locales) {
    const localePath = path.join(docsRoot, locale, 'library')

    function scanDir(dir: string, currentSlug: string[] = []): void {
      if (!fs.existsSync(dir)) return

      const items = fs.readdirSync(dir)

      for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          // Check if this directory has an index.mdx file
          const indexPath = path.join(fullPath, 'index.mdx')
          if (fs.existsSync(indexPath)) {
            params.push({ locale, slug: [...currentSlug, item] })
          }
          // Continue scanning subdirectories
          scanDir(fullPath, [...currentSlug, item])
        } else if (item.endsWith('.mdx') && item !== 'index.mdx') {
          // For non-index .mdx files, create slugs for each file
          const slug = [...currentSlug, item.replace('.mdx', '')]
          params.push({ locale, slug })
        }
      }
    }

    scanDir(localePath)
  }

  return params
}
