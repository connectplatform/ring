export {
  scriptedVideoGenerationRequestSchema,
  generateVideoBodySchema,
  scriptedClipSchema,
  thumbnailSchema,
} from '@/lib/media/schemas'
export type {
  ScriptedVideoGenerationRequest,
  ScriptedClip,
  GenerateVideoBody,
  ThumbnailSpec,
  CastMember,
} from '@/lib/media/schemas'
export {
  compileFirstFramePrompt,
  compileScenePrompt,
  clipToGenerateVideoBody,
  resolveCastPlaceholders,
} from '@/lib/media/prompt-compiler'
export { renderAndUploadThumbnail } from '@/lib/media/thumbnail'
export type { RenderThumbnailInput, RenderThumbnailResult } from '@/lib/media/thumbnail'
