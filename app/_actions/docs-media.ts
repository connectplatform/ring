'use server'

import { auth } from '@/auth'
import { MediaConductor } from '@/lib/media/conductor/media-conductor'
import { AudioConductor } from '@/lib/audio'
import { readDocMatter } from '@/lib/docs/docs-article'
import { resolveDocFilePath } from '@/lib/docs/docs-path'
import {
  findDocsMediaCache,
  hashDocsContent,
  saveDocsMediaCache,
} from '@/lib/docs/docs-media-cache'
import { hasMemberPrivileges } from '@/features/auth/user-role'
import { logger } from '@/lib/logger'

export type DocsMediaActionResult = {
  success: boolean
  audioUrl?: string
  videoUrl?: string
  summary?: string
  cached?: boolean
  error?: string
  code?: string
}

function stripMdxForSpeech(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{`[\s\S]*?`\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]+\}/g, ' ')
    .replace(/[#*_>`\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)
}

/**
 * Generate TTS narration for a docs article via AudioConductor.
 * Cached by content hash — first click synthesizes + stores; later clicks reuse.
 * Any visitor may trigger (public docs); cost is amortized via cache.
 */
export async function generateDocNarration(input: {
  locale: string
  slug: string[]
  title: string
}): Promise<DocsMediaActionResult> {
  try {
    const { filePath } = resolveDocFilePath(input.locale, input.slug)
    if (!filePath) {
      return { success: false, error: 'Document not found' }
    }
    const matter = readDocMatter(filePath)
    if (!matter) {
      return { success: false, error: 'Document not found' }
    }

    const title = matter.data.title || input.title
    const plain = stripMdxForSpeech(`${title}. ${matter.content}`)
    const contentHash = hashDocsContent(`${input.locale}:${input.slug.join('/')}:${plain}`)

    const cached = await findDocsMediaCache({
      kind: 'narration',
      locale: input.locale,
      slug: input.slug,
      contentHash,
    })
    if (cached?.audioUrl) {
      return { success: true, audioUrl: cached.audioUrl, cached: true }
    }

    const lang =
      input.locale === 'uk' ? 'uk' : input.locale === 'ru' ? 'ru' : 'en'

    const audio = await AudioConductor.synthesize({
      text: plain,
      language: lang,
    })

    if (!audio.success || !audio.url) {
      return { success: false, error: audio.error || 'Narration failed' }
    }

    await saveDocsMediaCache({
      kind: 'narration',
      locale: input.locale,
      slug: input.slug,
      contentHash,
      audioUrl: audio.url,
    })

    return { success: true, audioUrl: audio.url, cached: false }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Narration failed'
    logger.error('[docs-media] generateDocNarration failed', {
      slug: input.slug,
      error: message,
    })
    return { success: false, error: message }
  }
}

/**
 * Generate docs walkthrough (summary TTS + optional draft video) via MediaConductor.
 * Video generation requires member+ session (cost control). Cached by content hash.
 */
export async function generateDocWalkthrough(input: {
  locale: string
  slug: string[]
  title: string
  enableVideo?: boolean
}): Promise<DocsMediaActionResult> {
  try {
    const session = await auth()
    const enableVideo = input.enableVideo === true

    if (enableVideo) {
      if (!session?.user?.id) {
        return {
          success: false,
          error: 'Sign in required for doc video walkthroughs',
          code: 'AUTH_REQUIRED',
        }
      }
      if (!hasMemberPrivileges(session.user.role as string)) {
        return {
          success: false,
          error: 'Member role or higher required for doc video generation',
          code: 'MEMBER_REQUIRED',
        }
      }
    }

    const { filePath } = resolveDocFilePath(input.locale, input.slug)
    if (!filePath) {
      return { success: false, error: 'Document not found' }
    }
    const matter = readDocMatter(filePath)
    if (!matter) {
      return { success: false, error: 'Document not found' }
    }

    const title = matter.data.title || input.title
    const contentHash = hashDocsContent(
      `${input.locale}:${input.slug.join('/')}:walkthrough:${enableVideo}:${matter.content}`
    )

    const cached = await findDocsMediaCache({
      kind: 'walkthrough',
      locale: input.locale,
      slug: input.slug,
      contentHash,
    })
    if (cached && (cached.audioUrl || cached.videoUrl)) {
      return {
        success: true,
        audioUrl: cached.audioUrl,
        videoUrl: cached.videoUrl,
        summary: cached.summary,
        cached: true,
      }
    }

    const result = await MediaConductor.generateDocWalkthrough({
      locale: input.locale,
      slug: input.slug,
      title,
      mdxContent: matter.content,
      actorId: session?.user?.id,
      enableVideo,
    })

    if (!result.audioUrl && !result.videoUrl) {
      return {
        success: false,
        error: result.errors[0] || 'Walkthrough generation failed',
        summary: result.summary,
      }
    }

    await saveDocsMediaCache({
      kind: 'walkthrough',
      locale: input.locale,
      slug: input.slug,
      contentHash,
      audioUrl: result.audioUrl,
      videoUrl: result.videoUrl,
      summary: result.summary,
    })

    return {
      success: true,
      audioUrl: result.audioUrl,
      videoUrl: result.videoUrl,
      summary: result.summary,
      cached: false,
      error: result.errors.length ? result.errors.join('; ') : undefined,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Walkthrough failed'
    logger.error('[docs-media] generateDocWalkthrough failed', {
      slug: input.slug,
      error: message,
    })
    return { success: false, error: message }
  }
}
