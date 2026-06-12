import { randomUUID } from 'crypto'
import { TextConductor } from '@/lib/text'
import { ImageConductor } from '@/lib/images/conductor/image-conductor'
import { AudioConductor } from '@/lib/audio'
import {
  createNewsArticleForAuthor,
  type NewsArticleAuthor,
} from '@/features/news/services/news-service'
import type { NewsArticle, NewsCategory, NewsFormData } from '@/features/news/types'
import { isValidLocale, resolveLocale } from '@/lib/locale-config'
import { logger } from '@/lib/logger'

const NEWS_CATEGORIES: NewsCategory[] = [
  'platform-updates',
  'partnerships',
  'community',
  'industry-news',
  'events',
  'announcements',
  'security',
  'press-releases',
  'tutorials',
  'other',
  'blogs',
]

const ARTICLE_DRAFT_SCHEMA = {
  name: 'news_article_draft',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content: { type: 'string', description: 'HTML article body' },
      excerpt: { type: 'string', description: 'Plain summary, max 300 chars' },
      tags: { type: 'array', items: { type: 'string' } },
      category: { type: 'string', enum: NEWS_CATEGORIES },
      detectedLocale: { type: 'string', description: 'ISO locale code e.g. en, uk, ru' },
      summary: { type: 'string', description: 'One paragraph for image prompt' },
    },
    required: ['title', 'content', 'excerpt', 'tags', 'category', 'detectedLocale', 'summary'],
    additionalProperties: false,
  },
} as const

interface ArticleDraftStructured extends Record<string, unknown> {
  title: string
  content: string
  excerpt: string
  tags: string[]
  category: string
  detectedLocale: string
  summary: string
}

export interface GenerateArticleInput {
  source: 'url' | 'search' | 'text'
  value: string
  instruction?: string
  locale?: string
  author: NewsArticleAuthor
  enableAudio?: boolean
  enableImage?: boolean
}

export interface GenerateArticleResult {
  success: boolean
  articleId?: string
  title?: string
  locale?: string
  featuredImage?: string
  audioUrl?: string
  error?: string
}

function defaultEnableAudio(): boolean {
  return process.env.NEWS_AUTOGEN_ENABLE_AUDIO !== 'false'
}

function defaultVisibility(): NewsFormData['visibility'] {
  const raw = process.env.NEWS_AUTOGEN_DEFAULT_VISIBILITY?.trim()
  if (raw === 'subscriber' || raw === 'member' || raw === 'confidential' || raw === 'blog-only' || raw === 'site-wide') {
    return raw
  }
  return 'public'
}

function normalizeCategory(value: string | undefined): NewsCategory {
  if (value && NEWS_CATEGORIES.includes(value as NewsCategory)) {
    return value as NewsCategory
  }
  return 'other'
}

function stripHtmlForSpeech(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)
}

function appendSourcesFooter(content: string, citations: string[] | undefined): string {
  if (!citations?.length) return content
  const unique = [...new Set(citations.filter(Boolean))]
  if (!unique.length) return content
  const items = unique.map((url) => `<li><a href="${url}" rel="noopener noreferrer">${url}</a></li>`).join('')
  return `${content}\n\n<h2>Sources</h2>\n<ul>${items}</ul>`
}

function buildResearchPrompt(input: GenerateArticleInput): string {
  const lines = [
    'Write a professional news article for the Ring Platform community newsroom.',
    'Use web_search and x_search to gather current facts. Cite real sources.',
    'Return JSON matching the schema. Content must be valid HTML (paragraphs, headings, links).',
    'Excerpt must be plain text under 300 characters.',
    'Pick the best category from the enum. Auto-detect language locale (en, uk, ru).',
  ]
  if (input.instruction?.trim()) {
    lines.push(`Editorial instruction: ${input.instruction.trim()}`)
  }
  if (input.locale?.trim()) {
    lines.push(`Preferred locale hint: ${input.locale.trim()}`)
  }
  if (input.source === 'url') {
    lines.push(`Research and summarize this URL: ${input.value}`)
  } else if (input.source === 'search') {
    lines.push(`Research this topic via web search: ${input.value}`)
  } else {
    lines.push(`Expand this source material into a full article:\n${input.value}`)
  }
  return lines.join('\n')
}

export async function generateNewsArticle(input: GenerateArticleInput): Promise<GenerateArticleResult> {
  if (!input.value?.trim()) {
    return { success: false, error: 'value is required' }
  }
  if (!input.author?.id) {
    return { success: false, error: 'author is required' }
  }

  try {
    const textResult = await TextConductor.generateStructured<ArticleDraftStructured>(
      {
        input: buildResearchPrompt(input),
        instructions:
          'You are an investigative tech journalist. Be factual, neutral, and cite sources. Do not invent quotes.',
        webSearch: true,
        xSearch: true,
      },
      ARTICLE_DRAFT_SCHEMA
    )

    if (!textResult.success || !textResult.structured) {
      return { success: false, error: textResult.error || 'Text generation failed' }
    }

    const draft = textResult.structured
    const detectedLocale = isValidLocale(draft.detectedLocale)
      ? draft.detectedLocale
      : resolveLocale(input.locale)
    const category = normalizeCategory(draft.category)
    const content = appendSourcesFooter(draft.content, textResult.citations)
    const excerpt = draft.excerpt.slice(0, 300)
    const translationGroupId = randomUUID()

    let featuredImage: string | undefined
    const enableImage = input.enableImage !== false
    if (enableImage) {
      const imageResult = await ImageConductor.generate({
        prompt: draft.summary || draft.title,
        purpose: 'news-featured',
        aspectRatio: '16:9',
        actorId: input.author.id,
      })
      if (imageResult.success && imageResult.images?.[0]?.url) {
        featuredImage = imageResult.images[0].url
      } else if (imageResult.error) {
        logger.warn('[article-generator] featured image failed', { error: imageResult.error })
      }
    }

    let audioUrl: string | undefined
    const enableAudio = input.enableAudio ?? defaultEnableAudio()
    if (enableAudio) {
      const speechText = `${draft.title}. ${excerpt}`
      const plain = stripHtmlForSpeech(speechText)
      const audioResult = await AudioConductor.synthesize({
        text: plain,
        language: detectedLocale === 'uk' ? 'uk' : detectedLocale === 'ru' ? 'ru' : 'en',
      })
      if (audioResult.success && audioResult.url) {
        audioUrl = audioResult.url
      } else if (audioResult.error) {
        logger.warn('[article-generator] TTS failed', { error: audioResult.error })
      }
    }

    const formData: NewsFormData = {
      title: draft.title.trim(),
      content,
      excerpt,
      category,
      tags: Array.isArray(draft.tags) ? draft.tags.map(String).slice(0, 12) : [],
      featuredImage,
      audioUrl,
      gallery: [],
      status: 'draft',
      visibility: defaultVisibility(),
      featured: false,
      seo: {
        metaTitle: draft.title.trim(),
        metaDescription: excerpt,
        keywords: Array.isArray(draft.tags) ? draft.tags.map(String) : [],
        ogImage: featuredImage,
        twitterImage: featuredImage,
      },
      promoteToMainPage: true,
      locale: detectedLocale,
    }

    const created = await createNewsArticleForAuthor(formData, input.author, {
      locale: detectedLocale,
      translationGroupId,
      availableTranslations: [detectedLocale],
      audioUrl,
      promoteToMainPage: true,
      mainPageStatus: 'awaiting_admin_approval',
      contentType: 'official',
    })

    if (!created.success || !created.data) {
      return { success: false, error: created.error || 'Failed to save draft article' }
    }

    const articleId = (created.data as NewsArticle).id

    return {
      success: true,
      articleId,
      title: draft.title,
      locale: detectedLocale,
      featuredImage,
      audioUrl,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('[article-generator] failed:', error)
    return { success: false, error: message }
  }
}
