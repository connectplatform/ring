import React from 'react'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import fs from 'fs'
import matter from 'gray-matter'
import type { Metadata } from 'next'
import { resolveDocFilePath, scanDocsStaticParams } from '@/lib/docs/docs-path'
import type { Locale } from '@/i18n/shared'
import { docsMdxComponents, getDocsMdxRemoteOptions } from '@/components/docs/mdx-docs-shared'

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
  const { filePath } = resolveDocFilePath(locale, slug)

  const titlePrefix = confidential ? 'Confidential Documentation' : 'Ring Platform Documentation'
  const defaultDescription = confidential
    ? 'Secure documentation for authorized Ring users.'
    : 'Complete documentation for the Ring Platform - a free open-source platform for solving human needs collectively with AI orchestration.'

  if (!filePath) {
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

  const { filePath } = resolveDocFilePath(locale, slug)

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

export function generateDocsStaticParams() {
  return scanDocsStaticParams()
}
