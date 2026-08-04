'use server'

import { auth } from '@/auth'
import { MediaConductor } from '@/lib/media/conductor/media-conductor'
import { readDocMatter } from '@/lib/docs/docs-article'
import { resolveDocFilePath } from '@/lib/docs/docs-path'
import {
  findDocsMediaCache,
  hashDocsContent,
  saveDocsMediaCache,
} from '@/lib/docs/docs-media-cache'
import {
  ensureDocsArticleEnrichmentBackground,
  ensureLlmText,
  ensureTtsAudio,
  getDocsArticleMediaStatus,
  recordDocsVisualMedia,
} from '@/lib/docs/docs-article-enrichment'
import type { DocsArticleMediaStatus } from '@/lib/docs/docs-media-types'
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
  status?: DocsArticleMediaStatus
  llmJson?: string
}

/** Pollable status for Audible / Agent / Visual controls. */
export async function getDocMediaStatus(input: {
  locale: string
  slug: string[]
}): Promise<DocsMediaActionResult> {
  try {
    const status = await getDocsArticleMediaStatus(input)
    if (!status) return { success: false, error: 'Document not found' }
    return { success: true, status }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Status failed'
    return { success: false, error: message }
  }
}

/**
 * Kick background enrichment (audible + NODUS) — used by Create / page hydrate.
 * Prefer RSC `after(ensureDocsArticleEnrichmentBackground)` on first paint; this is the client fallback.
 */
export async function ensureDocMediaBackground(input: {
  locale: string
  slug: string[]
  title: string
}): Promise<DocsMediaActionResult> {
  try {
    await ensureDocsArticleEnrichmentBackground(input)
    const status = await getDocsArticleMediaStatus(input)
    return { success: true, status: status ?? undefined }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Enrichment failed'
    logger.error('[docs-media] ensureDocMediaBackground failed', {
      slug: input.slug,
      error: message,
    })
    return { success: false, error: message }
  }
}

/**
 * Generate TTS narration via radio-host audible-text → AudioConductor (SHA256 object key).
 */
export async function generateDocNarration(input: {
  locale: string
  slug: string[]
  title: string
}): Promise<DocsMediaActionResult> {
  try {
    const result = await ensureTtsAudio({
      locale: input.locale,
      slug: input.slug,
      title: input.title,
    })

    await saveDocsMediaCache({
      kind: 'narration',
      locale: input.locale,
      slug: input.slug,
      contentHash: result.contentSha256.slice(0, 24),
      audioUrl: result.audioUrl,
      summary: result.audibleText.slice(0, 4000),
    })

    const status = await getDocsArticleMediaStatus(input)
    return {
      success: true,
      audioUrl: result.audioUrl,
      cached: result.cached,
      summary: result.audibleText.slice(0, 4000),
      status: status ?? undefined,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Narration failed'
    logger.error('[docs-media] generateDocNarration failed', {
      slug: input.slug,
      error: message,
    })
    return { success: false, error: message }
  }
}

/** Create or refresh agent NODUS; returns JSON string for clipboard. */
export async function createOrGetDocAgentNodus(input: {
  locale: string
  slug: string[]
  title: string
}): Promise<DocsMediaActionResult> {
  try {
    const llmText = await ensureLlmText({
      locale: input.locale,
      slug: input.slug,
      title: input.title,
    })
    const status = await getDocsArticleMediaStatus(input)
    return {
      success: true,
      llmJson: JSON.stringify(llmText, null, 2),
      status: status ?? undefined,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'NODUS generation failed'
    logger.error('[docs-media] createOrGetDocAgentNodus failed', {
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
      `${input.locale}:${input.slug.join('/')}:walkthrough:${enableVideo}:${matter.content}`,
    )

    const cached = await findDocsMediaCache({
      kind: 'walkthrough',
      locale: input.locale,
      slug: input.slug,
      contentHash,
    })
    if (cached && (cached.audioUrl || cached.videoUrl)) {
      await recordDocsVisualMedia({
        locale: input.locale,
        slug: input.slug,
        videoUrl: cached.videoUrl,
        audioUrl: cached.audioUrl,
      })
      const status = await getDocsArticleMediaStatus(input)
      return {
        success: true,
        audioUrl: cached.audioUrl,
        videoUrl: cached.videoUrl,
        summary: cached.summary,
        cached: true,
        status: status ?? undefined,
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

    await recordDocsVisualMedia({
      locale: input.locale,
      slug: input.slug,
      videoUrl: result.videoUrl,
      audioUrl: result.audioUrl,
    })

    const status = await getDocsArticleMediaStatus(input)
    return {
      success: true,
      audioUrl: result.audioUrl,
      videoUrl: result.videoUrl,
      summary: result.summary,
      cached: false,
      status: status ?? undefined,
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
