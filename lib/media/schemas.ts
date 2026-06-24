import { z } from 'zod'

export const dialogueLineSchema = z.object({
  speaker: z.string().min(1),
  line: z.string().min(1),
  tone: z.string().optional(),
})

export const sceneSchema = z.object({
  action: z.string().optional(),
  camera: z.string().optional(),
  dialogue: z.array(dialogueLineSchema).optional(),
})

export const firstFrameSchema = z.object({
  imagePrompt: z.string().optional(),
  imageUrl: z.string().url().optional(),
  imageProvider: z.enum(['xai', 'google']).optional(),
  imageModel: z.string().optional(),
  imageResolution: z.enum(['1k', '2k']).optional(),
})

export const videoConfigSchema = z.object({
  provider: z.enum(['xai']).optional(),
  model: z.string().optional(),
  qualityMode: z.enum(['draft', 'draft_i2v', 'production', 'production_i2v']).optional(),
  resolution: z.enum(['480p', '720p', '1080p']).optional(),
})

export const thumbnailOverlaySchema = z.object({
  text: z.string().min(1),
  role: z.enum(['title', 'subtitle', 'cta', 'caption']).optional(),
  position: z
    .enum(['top', 'center', 'bottom', 'top-left', 'bottom-left', 'bottom-right'])
    .optional(),
})

export const thumbnailSchema = z.object({
  enabled: z.boolean(),
  sourceFrame: z.enum(['firstFrame', 'generated']).optional(),
  template: z.enum(['default', 'title_card', 'cta_bar']).optional(),
  aspectRatio: z.string().optional(),
  overlays: z.array(thumbnailOverlaySchema).optional(),
})

export const castMemberSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().min(1),
  label: z.string().optional(),
})

export const clipRemasterSchema = z.object({
  sourceVideoUrl: z.string().url().optional(),
  remasterFromRequestId: z.string().optional(),
})

export const scriptedClipSchema = z.object({
  id: z.string().min(1),
  duration: z.number().int().min(1).max(15),
  aspectRatio: z.string().optional(),
  prompt: z.string().optional(),
  firstFrame: firstFrameSchema.optional(),
  scene: sceneSchema.optional(),
  video: videoConfigSchema.optional(),
  thumbnail: thumbnailSchema.optional(),
  remaster: clipRemasterSchema.optional(),
})

export const scriptedVideoDefaultsSchema = z.object({
  provider: z.enum(['xai', 'google']).optional(),
  qualityMode: z.enum(['draft', 'draft_i2v', 'production', 'production_i2v']).optional(),
  aspectRatio: z.string().optional(),
  imageResolution: z.enum(['1k', '2k']).optional(),
  videoResolution: z.enum(['480p', '720p', '1080p']).optional(),
  imageProvider: z.enum(['xai', 'google']).optional(),
  videoProvider: z.enum(['xai']).optional(),
  duration: z.number().int().min(1).max(15).optional(),
})

export const scriptedVideoGenerationRequestSchema = z.object({
  schemaVersion: z.literal('1.0'),
  requestId: z.string().min(1),
  project: z.string().optional(),
  purpose: z.string().optional(),
  refCode: z.string().optional(),
  defaults: scriptedVideoDefaultsSchema.optional(),
  cast: z.array(castMemberSchema).optional(),
  setting: z.string().optional(),
  clips: z.array(scriptedClipSchema).min(1),
})

export const generateVideoBodySchema = z.object({
  prompt: z.string().min(1),
  qualityMode: z.enum(['draft', 'draft_i2v', 'production', 'production_i2v']).optional(),
  remaster: z.boolean().optional(),
  duration: z.number().int().min(1).max(15).optional(),
  aspectRatio: z.string().optional(),
  resolution: z.enum(['480p', '720p', '1080p']).optional(),
  model: z.string().optional(),
  imageUrl: z.string().url().optional(),
  firstFramePrompt: z.string().optional(),
  imageProvider: z.enum(['xai', 'google']).optional(),
  imageModel: z.string().optional(),
  imageResolution: z.enum(['1k', '2k']).optional(),
  sourceVideoUrl: z.string().url().optional(),
  remasterFromVideoUrl: z.string().url().optional(),
  purpose: z.string().optional(),
  refCode: z.string().optional(),
  remasterFromRequestId: z.string().optional(),
  persistToFilebase: z.boolean().optional(),
  clipId: z.string().optional(),
  pipelineRequestId: z.string().optional(),
  thumbnail: thumbnailSchema.optional(),
})

export type DialogueLine = z.infer<typeof dialogueLineSchema>
export type SceneSpec = z.infer<typeof sceneSchema>
export type FirstFrameSpec = z.infer<typeof firstFrameSchema>
export type ThumbnailSpec = z.infer<typeof thumbnailSchema>
export type CastMember = z.infer<typeof castMemberSchema>
export type ScriptedClip = z.infer<typeof scriptedClipSchema>
export type ScriptedVideoDefaults = z.infer<typeof scriptedVideoDefaultsSchema>
export type ScriptedVideoGenerationRequest = z.infer<typeof scriptedVideoGenerationRequestSchema>
export type GenerateVideoBody = z.infer<typeof generateVideoBodySchema>
