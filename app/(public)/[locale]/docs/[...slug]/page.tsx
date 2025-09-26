import React from 'react'
import { notFound } from 'next/navigation'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { serialize } from 'next-mdx-remote/serialize'

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
  params: {
    locale: string
    slug: string[]
  }
}

export default async function DocPage({ params }: PageProps) {
  const { locale, slug } = params

  // Build the file path for the MDX file
  const docsRoot = path.join(process.cwd(), '..', 'ring-docs', 'content')
  let filePath: string

  // Handle different slug patterns
  if (slug.length === 1) {
    // Single segment: e.g., 'getting-started' -> 'getting-started/index.mdx'
    filePath = path.join(docsRoot, locale, 'library', slug[0], 'index.mdx')
  } else {
    // Multi-segment: e.g., 'getting-started', 'installation' -> 'getting-started/installation.mdx'
    filePath = path.join(docsRoot, locale, 'library', ...slug) + '.mdx'
  }

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      notFound()
    }

    // Read the MDX file
    const fileContents = fs.readFileSync(filePath, 'utf8')

    // Parse frontmatter
    const { data, content } = matter(fileContents)

    // Serialize the MDX content
    const mdxSource = await serialize(content, {
      mdxOptions: {
        development: process.env.NODE_ENV === 'development'
      }
    })

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-4">{data.title || 'Documentation'}</h1>
              {data.description && (
                <p className="text-xl text-gray-600 dark:text-gray-300">{data.description}</p>
              )}
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 prose prose-lg max-w-none dark:prose-invert">
              <MDXRemote source={mdxSource} components={components} />
            </div>
          </div>
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
  const docsRoot = path.join(process.cwd(), '..', 'ring-docs', 'content')
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
            // For directories with index.mdx, create a slug with just the directory name
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
