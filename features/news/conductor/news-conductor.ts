import 'server-only'

import {
  generateNewsArticle,
  type GenerateArticleInput,
  type GenerateArticleResult,
} from '@/features/news/services/article-generator'
import { generateArticleTranslations } from '@/features/news/services/article-translation'
import { AudioConductor } from '@/lib/audio'
import { ImageConductor } from '@/lib/images/conductor/image-conductor'
import { TextConductor } from '@/lib/text'
import { logger } from '@/lib/logger'

/**
 * NewsConductor — domain facade over article-generator / translation / media enrichment.
 * Reuses TextConductor, ImageConductor, AudioConductor without duplicating provider logic.
 */
export const NewsConductor = {
  async generateArticle(input: GenerateArticleInput): Promise<GenerateArticleResult> {
    return generateNewsArticle(input)
  },

  async translateArticle(
    articleId: string,
    actorId?: string
  ): Promise<{ created: string[]; skipped: string[]; error?: string }> {
    try {
      return await generateArticleTranslations(articleId, actorId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Translation failed'
      logger.error('[NewsConductor] translateArticle failed', { articleId, error: message })
      return { created: [], skipped: [], error: message }
    }
  },

  /**
   * Publish-time enrichment: TL;DR summary + optional TTS / featured image for existing copy.
   */
  async enrichArticleMedia(input: {
    title: string
    excerpt?: string
    contentHtml?: string
    locale?: string
    actorId?: string
    enableAudio?: boolean
    enableImage?: boolean
  }): Promise<{
    success: boolean
    summary?: string
    audioUrl?: string
    featuredImage?: string
    error?: string
  }> {
    try {
      const locale = input.locale === 'uk' || input.locale === 'ru' ? input.locale : 'en'
      let summary = input.excerpt?.trim() || ''

      if (!summary && input.contentHtml) {
        const plain = input.contentHtml
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 3000)
        const textResult = await TextConductor.generate({
          input: `Write a plain-text TL;DR (max 280 chars) for this article titled "${input.title}":\n${plain}`,
          instructions: 'Return only the summary text, no markdown.',
        })
        if (textResult.success && textResult.text?.trim()) {
          summary = textResult.text.trim().slice(0, 300)
        }
      }

      if (!summary) {
        summary = input.title
      }

      let featuredImage: string | undefined
      if (input.enableImage !== false) {
        const imageResult = await ImageConductor.generate({
          prompt: summary || input.title,
          purpose: 'news-featured',
          aspectRatio: '16:9',
          actorId: input.actorId,
        })
        if (imageResult.success && imageResult.images?.[0]?.url) {
          featuredImage = imageResult.images[0].url
        }
      }

      let audioUrl: string | undefined
      if (input.enableAudio !== false) {
        const speech = `${input.title}. ${summary}`.slice(0, 4000)
        const audioResult = await AudioConductor.synthesize({
          text: speech,
          language: locale,
        })
        if (audioResult.success && audioResult.url) {
          audioUrl = audioResult.url
        }
      }

      return { success: true, summary, audioUrl, featuredImage }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'enrichArticleMedia failed'
      return { success: false, error: message }
    }
  },
}
