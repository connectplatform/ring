import React from 'react'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import fs from 'fs'
import matter from 'gray-matter'
import type { Metadata } from 'next'
import { getDocsLocaleRoot, resolveDocFilePath } from '@/lib/docs/resolve-doc-file-path'
import type { Locale } from '@/i18n/shared'
import { SUPPORTED_LOCALES } from '@/lib/locale-config'
import { docsMdxComponents, getDocsMdxRemoteOptions } from '@/components/docs/mdx-docs-shared'
import path from 'path'

type RenderArgs = {
  locale: Locale
  slug: string[]
}

type DocRenderContext = RenderArgs & {
  confidential?: boolean
}

export async function generateDocsMetadata({
  locale,
  slug,
  confidential = false,
}: DocRenderContext): Promise<Metadata> {
  const { filePath, redirect: redirectPath } = resolveDocFilePath(locale, slug)

  const titlePrefix = confidential ? 'Confidential Documentation' : 'Ring Platform Documentation'
  const defaultDescription = confidential
    ? 'Secure documentation for authorized Ring users.'
    : 'Complete documentation for the Ring Platform - a free open-source platform for solving human needs collectively with AI orchestration.'

  if (redirectPath || !filePath) {
    return {
      title: titlePrefix,
      description: confidential ? 'Secure documentation section for authorized Ring users.' : 'Complete documentation for the Ring Platform',
    }
  }

  try {
    if (!fs.existsSync(filePath)) {
      return {
        title: titlePrefix,
        description: confidential
          ? 'The requested confidential documentation page could not be found.'
          : 'The requested documentation page could not be found.',
      }
    }

    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(fileContents)

    return {
      title: data.title || titlePrefix,
      description: data.description || defaultDescription,
      keywords: data.keywords || (confidential
        ? ['Ring Platform', 'documentation', 'confidential']
        : ['Ring Platform', 'documentation', 'AI orchestration', 'open-source']),
      openGraph: {
        title: data.title || titlePrefix,
        description: data.description || defaultDescription,
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: data.title || titlePrefix,
        description: data.description || defaultDescription,
      },
    }
  } catch (error) {
    console.error('Error generating docs metadata:', filePath, error)
    return {
      title: titlePrefix,
      description: defaultDescription,
    }
  }
}

export async function renderDocsPage({
  locale,
  slug,
  confidential = false,
}: DocRenderContext) {
  await connection()

  const { filePath, redirect: redirectPath } = resolveDocFilePath(locale, slug)
  if (redirectPath) {
    redirect(redirectPath)
  }

  if (!filePath) {
    notFound()
  }

  try {
    if (!fs.existsSync(filePath)) {
      console.error(`Doc file not found: ${filePath}`)
      notFound()
    }

    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { content } = matter(fileContents)

    return (
      <div className="w-full h-full py-8 px-4 md:px-6 lg:px-8">
        <div className="w-full max-w-full">
          <MDXRemote
            source={content}
            components={docsMdxComponents}
            options={getDocsMdxRemoteOptions()}
          />
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading doc:', error)
    notFound()
  }
}

export async function generateDocsStaticParams() {
  const docsRoot = path.join(process.cwd(), 'docs', 'content')
  const locales = SUPPORTED_LOCALES
  const params: { locale: string; slug: string[] }[] = []

  for (const locale of locales) {
    const localePath = getDocsLocaleRoot(locale, docsRoot)

    const scanDir = (dir: string, currentSlug: string[] = []): void => {
      if (!fs.existsSync(dir)) return

      const items = fs.readdirSync(dir)

      for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          const indexPath = path.join(fullPath, 'index.mdx')
          if (fs.existsSync(indexPath)) {
            params.push({ locale, slug: [...currentSlug, item] })
          }
          scanDir(fullPath, [...currentSlug, item])
        } else if (item.endsWith('.mdx') && item !== 'index.mdx') {
          params.push({
            locale,
            slug: [...currentSlug, item.replace('.mdx', '')],
          })
        }
      }
    }

    scanDir(localePath)
  }

  return params
}

