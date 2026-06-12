export type AudioProviderId = 'xai'

export interface SynthesizeAudioContext {
  text: string
  voiceId?: string
  language?: string
  provider?: AudioProviderId
}

export interface SynthesizeAudioResult {
  success: boolean
  url?: string
  objectKey?: string
  provider?: AudioProviderId
  error?: string
}
