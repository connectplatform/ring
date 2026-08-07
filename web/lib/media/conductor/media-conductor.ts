import 'server-only'

import { VideoConductor } from '@/lib/video/conductor/video-conductor'
import type { GenerateVideoResult } from '@/lib/video/conductor/types'
import type { GenerateVideoContext } from '@/lib/video/conductor/types'
import { clipToGenerateVideoBody } from '@/lib/media/prompt-compiler'
import type { ScriptedVideoGenerationRequest } from '@/lib/media/schemas'
import { AudioConductor } from '@/lib/audio'
import { TextConductor } from '@/lib/text'
import { logger } from '@/lib/logger'

function bodyToVideoContext(
  body: ReturnType<typeof clipToGenerateVideoBody>,
  actorId?: string
): GenerateVideoContext {
  return {
    prompt: body.prompt,
    qualityMode: body.qualityMode,
    duration: body.duration,
    aspectRatio: body.aspectRatio,
    resolution: body.resolution,
    model: body.model,
    imageUrl: body.imageUrl,
    firstFramePrompt: body.firstFramePrompt,
    imageProvider: body.imageProvider,
    imageModel: body.imageModel,
    imageResolution: body.imageResolution,
    purpose: body.purpose,
    refCode: body.refCode,
    clipId: body.clipId,
    pipelineRequestId: body.pipelineRequestId,
    thumbnail: body.thumbnail,
    sourceVideoUrl: body.sourceVideoUrl,
    remasterFromRequestId: body.remasterFromRequestId,
    persistToFilebase: body.persistToFilebase ?? true,
    actorId,
  }
}

/**
 * MediaConductor — orchestrates scripted media via existing Image/Video/Audio conductors.
 * Does not reimplement provider logic; compiles prompts then delegates.
 */
export const MediaConductor = {
  async generateClip(
    request: ScriptedVideoGenerationRequest,
    clipId: string,
    actorId?: string,
    options?: { remaster?: boolean; sourceVideoUrl?: string }
  ): Promise<GenerateVideoResult> {
    const clip = request.clips.find((c) => c.id === clipId)
    if (!clip) {
      return { success: false, error: `Clip not found: ${clipId}` }
    }
    const body = clipToGenerateVideoBody(request, clip, options)
    const ctx = bodyToVideoContext(body, actorId)
    return options?.remaster || body.remaster
      ? VideoConductor.remaster(ctx)
      : VideoConductor.generate(ctx)
  },

  async generateScript(
    request: ScriptedVideoGenerationRequest,
    actorId?: string
  ): Promise<{ requestId: string; clips: GenerateVideoResult[] }> {
    const clips: GenerateVideoResult[] = []
    for (const clip of request.clips) {
      const result = await this.generateClip(request, clip.id, actorId)
      clips.push(result)
      if (!result.success) {
        logger.warn('[MediaConductor] clip failed; continuing pipeline', {
          requestId: request.requestId,
          clipId: clip.id,
          error: result.error,
        })
      }
    }
    return { requestId: request.requestId, clips }
  },

  /**
   * Docs walkthrough: summarize MDX → optional short video + always attempt TTS.
   */
  async generateDocWalkthrough(input: {
    locale: string
    slug: string[]
    title: string
    mdxContent: string
    actorId?: string
    enableVideo?: boolean
  }): Promise<{ audioUrl?: string; videoUrl?: string; summary?: string; errors: string[] }> {
    const errors: string[] = []
    const plain = input.mdxContent
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\{`[\s\S]*?`\}/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000)

    let summary = `${input.title}. ${plain.slice(0, 800)}`
    try {
      const textResult = await TextConductor.generate({
        input: `Summarize this documentation page for a short spoken narration (max 400 words). Title: ${input.title}\n\n${plain.slice(0, 4000)}`,
        instructions: 'Return plain spoken English/Ukrainian/Russian matching the locale. No markdown.',
      })
      if (textResult.success && textResult.text?.trim()) {
        summary = textResult.text.trim().slice(0, 4000)
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Text summary failed')
    }

    let audioUrl: string | undefined
    const lang =
      input.locale === 'uk' ? 'uk' : input.locale === 'ru' ? 'ru' : 'en'
    const audio = await AudioConductor.synthesize({
      text: summary,
      language: lang,
    })
    if (audio.success && audio.url) {
      audioUrl = audio.url
    } else if (audio.error) {
      errors.push(audio.error)
    }

    let videoUrl: string | undefined
    if (input.enableVideo) {
      const video = await VideoConductor.generate({
        prompt: `Documentary-style documentation walkthrough title card and soft motion for: ${input.title}. ${summary.slice(0, 400)}`,
        qualityMode: 'draft',
        aspectRatio: '16:9',
        purpose: 'docs-walkthrough',
        refCode: input.slug.join('/'),
        actorId: input.actorId,
        persistToFilebase: true,
      })
      if (video.success && video.video?.url) {
        videoUrl = video.video.url
      } else if (video.error) {
        errors.push(video.error)
      }
    }

    return { audioUrl, videoUrl, summary, errors }
  },

  /**
   * Mood Player track generation: Suno-compatible music → file() storage.
   * Billing is owned by the caller (features/mood-player/billing).
   */
  async generateMoodTrack(input: {
    lyrics: string
    style: string
    title: string
    makeInstrumental?: boolean
    actorId?: string
    model?: string
    negativeTags?: string
  }): Promise<{
    success: boolean
    url?: string
    fileId?: string
    objectKey?: string
    provider?: 'suno'
    externalId?: string
    error?: string
  }> {
    const result = await AudioConductor.generateMusic({
      lyrics: input.lyrics,
      style: input.style,
      title: input.title,
      makeInstrumental: input.makeInstrumental,
      actorId: input.actorId,
      model: input.model,
      negativeTags: input.negativeTags,
      provider: 'suno',
    })
    if (!result.success) {
      logger.warn('[MediaConductor] generateMoodTrack failed', { error: result.error })
    }
    return result
  },
}
