import type {
  CastMember,
  ScriptedClip,
  ScriptedVideoGenerationRequest,
} from '@/lib/media/schemas'
import type { GenerateVideoBody } from '@/lib/media/schemas'

const CAST_PLACEHOLDER = /\{\{([a-z][a-z0-9_]*)\}\}/gi

/** Replace {{cast_id}} tokens with cast member descriptions */
export function resolveCastPlaceholders(text: string, cast: CastMember[] = []): string {
  const map = new Map(cast.map((c) => [c.id, c.description]))
  return text.replace(CAST_PLACEHOLDER, (_, id: string) => map.get(id) ?? `{{${id}}}`)
}

/** Compile agent-authored first-frame still prompt with setting + cast refs */
export function compileFirstFramePrompt(
  clip: ScriptedClip,
  cast: CastMember[] = [],
  setting?: string,
): string | undefined {
  const raw = clip.firstFrame?.imagePrompt?.trim()
  if (!raw) return undefined

  let prompt = resolveCastPlaceholders(raw, cast)
  if (setting?.trim()) {
    prompt = `${prompt} Setting: ${setting.trim()}.`
  }
  if (clip.aspectRatio) {
    prompt = `${prompt} Aspect ratio ${clip.aspectRatio}, cinematic still frame, photorealistic, no text overlays, no watermarks.`
  }
  return prompt.trim()
}

function formatSpeakerLabel(speaker: string, cast: CastMember[]): string {
  const member = cast.find((c) => c.id === speaker)
  if (member?.label) return member.label
  if (member?.description) {
    const short = member.description.split(/[,.]/)[0]?.trim()
    if (short && short.length < 80) return short
  }
  return speaker.replace(/_/g, ' ')
}

/** Build guideline-compliant ACTION / DIALOGUE / CAMERA I2V prompt */
export function compileScenePrompt(
  clip: ScriptedClip,
  cast: CastMember[] = [],
  setting?: string,
): string {
  if (clip.prompt?.trim()) {
    return clip.prompt.trim()
  }

  const parts: string[] = []

  if (setting?.trim()) {
    parts.push(setting.trim())
  }

  if (clip.scene?.camera?.trim()) {
    parts.push(`CAMERA: ${clip.scene.camera.trim()}`)
  }

  if (clip.scene?.action?.trim()) {
    parts.push(`ACTION: ${resolveCastPlaceholders(clip.scene.action.trim(), cast)}`)
  }

  const dialogue = clip.scene?.dialogue ?? []
  if (dialogue.length > 0) {
    const lines = dialogue.map((d) => {
      const label = formatSpeakerLabel(d.speaker, cast)
      const tone = d.tone?.trim() ? ` (${d.tone.trim()})` : ''
      return `${label}${tone} says: "${d.line.trim()}"`
    })
    parts.push(`DIALOGUE: ${lines.join(' ')}`)
    parts.push('Realistic lip movement, speaking over ambient sound, no burned-in subtitles.')
  }

  if (parts.length === 0) {
    throw new Error(`Clip ${clip.id}: scene or prompt is required`)
  }

  return parts.join(' ')
}

/** Map a scripted clip + request defaults to ring-video-create MCP body */
export function clipToGenerateVideoBody(
  request: ScriptedVideoGenerationRequest,
  clip: ScriptedClip,
  options?: {
    remaster?: boolean
    sourceVideoUrl?: string
    remasterFromRequestId?: string
  },
): GenerateVideoBody {
  const defaults = request.defaults ?? {}
  const scenePrompt = compileScenePrompt(clip, request.cast ?? [], request.setting)
  const firstFramePrompt = compileFirstFramePrompt(clip, request.cast ?? [], request.setting)
  const imageUrl = clip.firstFrame?.imageUrl?.trim() || undefined

  const qualityMode = clip.video?.qualityMode ?? defaults.qualityMode ?? 'draft'
  const needsI2v = Boolean(firstFramePrompt || imageUrl)

  return {
    prompt: scenePrompt,
    qualityMode: needsI2v && qualityMode === 'draft' ? 'draft' : qualityMode,
    duration: clip.duration ?? defaults.duration,
    aspectRatio: clip.aspectRatio ?? defaults.aspectRatio ?? '16:9',
    resolution: clip.video?.resolution ?? defaults.videoResolution,
    model: clip.video?.model,
    imageUrl,
    firstFramePrompt: imageUrl ? undefined : firstFramePrompt,
    imageProvider: clip.firstFrame?.imageProvider ?? defaults.imageProvider ?? defaults.provider,
    imageModel: clip.firstFrame?.imageModel,
    imageResolution: clip.firstFrame?.imageResolution ?? defaults.imageResolution ?? '2k',
    purpose: request.purpose,
    refCode: request.refCode ?? request.requestId,
    clipId: clip.id,
    pipelineRequestId: request.requestId,
    thumbnail: clip.thumbnail,
    remaster: options?.remaster,
    sourceVideoUrl:
      options?.sourceVideoUrl?.trim() ||
      clip.remaster?.sourceVideoUrl?.trim() ||
      undefined,
    remasterFromRequestId:
      options?.remasterFromRequestId || clip.remaster?.remasterFromRequestId,
    persistToFilebase: true,
  }
}
