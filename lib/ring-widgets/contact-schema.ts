import { z } from 'zod'
import { phoneNumberSchema } from '@/lib/validation/phone'

export const ringWidgetsCustomLinkSchema = z.object({
  uri: z.string().url(),
  name: z.string().min(1).max(120),
  /** Resolved from target OG metadata on save; optional at render time. */
  desc: z.string().max(500).optional(),
})

export const ringWidgetsContactSchema = z.object({
  firstName: z.string().max(32).optional(),
  lastName: z.string().max(64).optional(),
  nickname: z.string().max(24).optional(),
  photoAvatar: z
    .string()
    .max(2048)
    .refine((value) => value.startsWith('/') || z.string().url().safeParse(value).success, {
      message: 'Avatar must be a public URL or site path (e.g. /images/avatar.jpg)',
    })
    .optional(),
  xUsername: z.string().max(24).optional(),
  linkedInUsername: z.string().max(24).optional(),
  facebookUsername: z.string().max(24).optional(),
  instagramUsername: z.string().max(24).optional(),
  telegramUsername: z.string().max(24).optional(),
  whatsAppBusinessNumber: phoneNumberSchema.optional(),
  /** Ring platform public profile username — maps to /u/{username}. */
  projectUsername: z.string().max(64).optional(),
  customLinks: z.array(ringWidgetsCustomLinkSchema).max(12).optional(),
})

export type RingWidgetsContactProps = z.infer<typeof ringWidgetsContactSchema>
export type RingWidgetsCustomLink = z.infer<typeof ringWidgetsCustomLinkSchema>

export function parseRingWidgetsContact(input: unknown): RingWidgetsContactProps {
  return ringWidgetsContactSchema.parse(input)
}
