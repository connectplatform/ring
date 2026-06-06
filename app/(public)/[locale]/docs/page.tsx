import type { Metadata } from 'next'
import { MDXRemote } from 'next-mdx-remote/rsc'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { routing, type Locale } from '@/i18n/routing'
import { setRequestLocale, getMessages } from 'next-intl/server'
import { docsMdxComponents, getDocsMdxRemoteOptions } from '@/components/docs/mdx-docs-shared'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'docs',
    pathname: '/docs',
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
  })
}

export default async function DocsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const resolvedParams = await params
  const { locale: rawLocale } = resolvedParams
  const currentLocale = routing.locales.includes(rawLocale as Locale) ? rawLocale : routing.defaultLocale
  setRequestLocale(currentLocale)

  const messages = await getMessages()
  const docsSeo = (messages.seo as { docs?: { title?: string; description?: string } } | undefined)
    ?.docs

  const filePath = path.join(process.cwd(), 'docs', 'content', currentLocale, 'library', 'index.mdx')

  let content = ''

  try {
    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, 'utf8')
      const { content: mdxContent } = matter(fileContents)
      content = mdxContent
    }
  } catch (error) {
    console.error('Error reading docs content:', error)
  }

  return (
    <div className="w-full h-full py-8 px-4 md:px-6 lg:px-8">
      <div className="w-full max-w-4xl mx-auto">
        {content ? (
          <MDXRemote source={content} components={docsMdxComponents} options={getDocsMdxRemoteOptions()} />
        ) : (
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-6">
              {docsSeo?.title ?? 'Documentation - Ring Platform'}
            </h1>
            <p className="text-muted-foreground">
              {docsSeo?.description ??
                'Ring Platform documentation: architecture, deployment, modules, and integration guides.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
