export type AudioProviderId = 'xai' | 'suno'

export interface SynthesizeAudioContext {
  text: string
  voiceId?: string
  language?: string
  provider?: AudioProviderId
  /** When set, upload uses this object key (e.g. docs SHA256.mp3) instead of random UUID. */
  objectKey?: string
}

export interface SynthesizeAudioResult {
  success: boolean
  url?: string
  objectKey?: string
  provider?: AudioProviderId
  error?: string
}

export interface GenerateMusicContext {
  lyrics: string
  style: string
  title: string
  makeInstrumental?: boolean
  model?: string
  negativeTags?: string
  provider?: 'suno'
  /** Optional actor for object-key metadata */
  actorId?: string
}

export interface GenerateMusicResult {
  success: boolean
  url?: string
  objectKey?: string
  fileId?: string
  provider?: 'suno'
  externalId?: string
  error?: string
}
