export const VIDEO_VERIFICATION_CHANNELS = [
  'telegram',
  'whatsapp',
  'email_zoom',
  'email_hangouts',
  'skype',
] as const

export type VideoVerificationChannel = (typeof VIDEO_VERIFICATION_CHANNELS)[number]
