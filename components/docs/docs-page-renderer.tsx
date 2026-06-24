import React from 'react'
import { connection } from 'next/server'
import fs from 'fs'
import matter from 'gray-matter'
import { MDXRemote } from 'next-mdx-remote/rsc'
import type { Metadata } from 'next'
import { resolveDocFilePath, scanDocsStaticParams } from '@/lib/docs/docs-path'
import {
  buildDocsPublicPath,
  docExists,
  isValidDocsSection,
} from '@/lib/docs/docs-sections'
import type { Locale } from '@/i18n/shared'
import { docsMdxComponents, getDocsMdxRemoteOptions } from '@/components/docs/mdx-docs-shared'
import { DocsNotFound } from '@/components/docs/docs-not-found'
import { recordDocsPageView } from '@/features/analytics/lib/docs-analytics'

type RenderArgs = {
  locale: Locale
  slug: string[]
}

type DocRenderContext = RenderArgs & {
  confidential?: boolean
}

export type DocsPageRenderResult =
  | { status: 'ok'; content: React.ReactNode }
  | {
      status: 'not_found'
      locale: Locale
      slug: string[]
      reason: 'missing_file' | 'invalid_path'
      categoryValid: boolean
      path: string
    }

function missingDocsMetadata(confidential: boolean): Metadata {
  const titlePrefix = confidential ? 'Confidential Documentation' : 'Ring Platform Documentation'
  return {
    title: `Page not found | ${titlePrefix}`,
    description: 'The requested documentation page could not be found in the Ring docs library.',
    robots: { index: false, follow: false },
  }
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

  if (!filePath || !docExists(locale, slug)) {
    return missingDocsMetadata(confidential)
  }

  try {
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
}: DocRenderContext): Promise<DocsPageRenderResult> {
  await connection()

  const path = buildDocsPublicPath(locale, slug)
  const category = slug[0]
  const categoryValid = category ? isValidDocsSection(locale, category) : slug.length === 0

  if (!resolveDocFilePath(locale, slug).filePath) {
    return {
      status: 'not_found',
      locale,
      slug,
      reason: 'invalid_path',
      categoryValid: false,
      path,
    }
  }

  if (!docExists(locale, slug)) {
    return {
      status: 'not_found',
      locale,
      slug,
      reason: 'missing_file',
      categoryValid,
      path,
    }
  }

  const { filePath } = resolveDocFilePath(locale, slug)
  if (!filePath) {
    return {
      status: 'not_found',
      locale,
      slug,
      reason: 'invalid_path',
      categoryValid,
      path,
    }
  }

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { content } = matter(fileContents)

    await recordDocsPageView({ locale, slug, path })

    return {
      status: 'ok',
      content: (
        <div className="w-full h-full py-8 px-4 md:px-6 lg:px-8">
          <div className="w-full max-w-full">
            <MDXRemote
              source={content}
              components={docsMdxComponents}
              options={getDocsMdxRemoteOptions()}
            />
          </div>
        </div>
      ),
    }
  } catch (error) {
    console.error('Error loading doc:', filePath, error)
    return {
      status: 'not_found',
      locale,
      slug,
      reason: 'missing_file',
      categoryValid,
      path,
    }
  }
}

export function generateDocsStaticParams() {
  return scanDocsStaticParams()
}
