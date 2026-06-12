import { randomUUID } from 'crypto'
import { TextConductor } from '@/lib/text'
import { db } from '@/lib/database'
import { SUPPORTED_LOCALES } from '@/lib/locale-config'
import { translitSlug } from '@/lib/news/translit-slug'
import { createNewsArticleForAuthor } from '@/features/news/services/news-service'
import type { MainPageStatus, NewsFormData, NewsCategory } from '@/features/news/types'
import { logger } from '@/lib/logger'

const TRANSLATION_SCHEMA = {
  name: 'news_article_translation',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content: { type: 'string' },
      excerpt: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'content', 'excerpt', 'tags'],
    additionalProperties: false,
  },
} as const

interface TranslationStructured extends Record<string, unknown> {
  title: string
  content: string
  excerpt: string
  tags: string[]
}

async function uniqueSlug(base: string, locale: string): Promise<string> {
  let candidate = `${base}-${locale}`
  for (let i = 0; i < 5; i++) {
    const found = await db().queryDocs({
      collection: 'news',
      filters: [{ field: 'slug', operator: '==', value: candidate }],
      pagination: { limit: 1 },
    })
    if (!found.success || !found.data?.length) return candidate
    candidate = `${base}-${locale}-${randomUUID().slice(0, 6)}`
  }
  return candidate
}

export async function generateArticleTranslations(
  articleId: string,
  actorId?: string
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = []
  const skipped: string[] = []

  try {
    const found = await db().findDocById<Record<string, unknown>>('news', articleId)
    if (!found.success || !found.data) {
      logger.warn('[article-translation] source article not found', { articleId })
      return { created, skipped }
    }

    const source = found.data
    const sourceLocale = String(source.locale ?? 'en')
    const translationGroupId = String(source.translationGroupId ?? articleId)
    const author = {
      id: String(source.authorId ?? actorId ?? 'system'),
      name: String(source.authorName ?? 'Ring Newsroom'),
    }

    const targetLocales = SUPPORTED_LOCALES.filter((loc) => loc !== sourceLocale)

    for (const locale of targetLocales) {
      const existing = await db().queryDocs({
        collection: 'news',
        filters: [
          { field: 'translationGroupId', operator: '==', value: translationGroupId },
          { field: 'locale', operator: '==', value: locale },
        ],
        pagination: { limit: 1 },
      })
      if (existing.success && existing.data && existing.data.length > 0) {
        skipped.push(locale)
        continue
      }

      const textResult = await TextConductor.generateStructured<TranslationStructured>(
        {
          input: [
            `Translate this news article to locale "${locale}".`,
            'Preserve HTML structure and links. Do not use web search.',
            `Title: ${String(source.title ?? '')}`,
            `Excerpt: ${String(source.excerpt ?? '')}`,
            `Content HTML:\n${String(source.content ?? '')}`,
            `Tags: ${JSON.stringify(source.tags ?? [])}`,
          ].join('\n'),
          instructions: 'Professional news translator. Keep factual tone and formatting.',
          webSearch: false,
          xSearch: false,
        },
        TRANSLATION_SCHEMA
      )

      if (!textResult.success || !textResult.structured) {
        logger.warn('[article-translation] failed for locale', { locale, error: textResult.error })
        skipped.push(locale)
        continue
      }

      const translated = textResult.structured
      const baseSlug = translitSlug(String(source.slug ?? source.title ?? 'article'))
      const slug = await uniqueSlug(baseSlug, locale)

      const formData: NewsFormData = {
        title: translated.title,
        slug,
        content: translated.content,
        excerpt: translated.excerpt.slice(0, 300),
        category: (source.category as NewsCategory) || 'other',
        tags: translated.tags,
        featuredImage: source.featuredImage as string | undefined,
        audioUrl: source.audioUrl as string | undefined,
        gallery: Array.isArray(source.gallery) ? (source.gallery as string[]) : [],
        status: (source.status as NewsFormData['status']) || 'published',
        visibility: (source.visibility as NewsFormData['visibility']) || 'site-wide',
        featured: Boolean(source.featured),
        seo: source.seo as NewsFormData['seo'],
        locale,
        promoteToMainPage: Boolean(source.promoteToMainPage),
        contentType: source.contentType as NewsFormData['contentType'],
      }

      const result = await createNewsArticleForAuthor(formData, author, {
        locale,
        translationGroupId,
        availableTranslations: [],
        audioUrl: formData.audioUrl,
        promoteToMainPage: formData.promoteToMainPage,
        mainPageStatus: source.mainPageStatus as MainPageStatus | undefined,
        contentType: formData.contentType,
      })

      if (result.success && result.data) {
        created.push(locale)
      } else {
        skipped.push(locale)
      }
    }

    const allLocales = [sourceLocale, ...created]
    const siblings = await db().queryDocs({
      collection: 'news',
      filters: [{ field: 'translationGroupId', operator: '==', value: translationGroupId }],
      pagination: { limit: 50 },
    })

    if (siblings.success && siblings.data) {
      for (const row of siblings.data) {
        await db().updateDoc('news', row.id, {
          translationGroupId,
          availableTranslations: allLocales,
        })
      }
    }

    return { created, skipped }
  } catch (error) {
    logger.error('[article-translation] error:', error)
    return { created, skipped }
  }
}
