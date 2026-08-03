/**
 * Get User By Username — public personal-page hydrate + privacy projection.
 * Loads section-capable fields; callers must project before rendering to strangers.
 */

import type {
  AuthUser,
  CommunicationChannels,
  CulturalContext,
  ExternalIntegrations,
} from '@/features/auth/types'
import { cache } from 'react'
import { db } from '@/lib/database'
import { DEFAULT_LOCALE } from '@/lib/locale-config'
import { getDefaultTheme } from '@/lib/ring-config-core'
import { resolvePersistedUserRole } from '@/features/auth/user-role'
import {
  acceptsProfileDms,
  normalizePersonalPageSections,
  normalizePublicProfileFields,
  personalPageFieldEnabled,
  personalPageSectionEnabled,
  type PersonalPageSectionId,
  type PublicProfileFieldsMap,
} from '@/features/auth/lib/personal-page-sections'

function mapCommunication(row: Record<string, unknown>): CommunicationChannels | undefined {
  const commData = (row.communication as Record<string, unknown> | undefined) || {}
  const has =
    row.communication ||
    row.telegram_username ||
    row.whatsapp_number ||
    row.preferred_contact_method ||
    row.phoneNumber
  if (!has) return undefined

  return {
    phoneNumber:
      (commData.phoneNumber as string | undefined) ||
      (row.phoneNumber as string | undefined),
    telegramUsername:
      (commData.telegramUsername as string | undefined) ||
      (row.telegram_username as string | undefined),
    telegramId: commData.telegramId
      ? String(commData.telegramId)
      : row.telegram_id
        ? String(row.telegram_id)
        : undefined,
    whatsappNumber:
      (commData.whatsappNumber as string | undefined) ||
      (row.whatsapp_number as string | undefined),
    preferredContactMethod:
      ((commData.preferredContactMethod as CommunicationChannels['preferredContactMethod']) ||
        (row.preferred_contact_method as CommunicationChannels['preferredContactMethod']) ||
        'email'),
  }
}

function mapCultural(row: Record<string, unknown>): CulturalContext | undefined {
  const cultData = (row.cultural as Record<string, unknown> | undefined) || {}
  const has =
    row.cultural || row.languages || row.cultural_background || row.country || row.timezone
  if (!has) return undefined
  return {
    country: (cultData.country as string | undefined) || (row.country as string | undefined),
    timezone:
      (cultData.timezone as string | undefined) ||
      (row.timezone as string | undefined) ||
      'UTC',
    languages:
      (cultData.languages as string[] | undefined) ||
      (row.languages as string[] | undefined) ||
      [],
    culturalBackground:
      cultData.culturalBackground || row.cultural_background,
  }
}

function mapIntegrations(row: Record<string, unknown>): ExternalIntegrations | undefined {
  const intData = (row.integrations as Record<string, unknown> | undefined) || {}
  if (!row.integrations && !row.external_accounts && !row.social_profiles) return undefined
  return {
    externalAccounts:
      (intData.externalAccounts as ExternalIntegrations['externalAccounts']) ||
      (row.external_accounts as ExternalIntegrations['externalAccounts']),
    walletAddresses:
      (intData.walletAddresses as ExternalIntegrations['walletAddresses']) ||
      (row.wallet_addresses as ExternalIntegrations['walletAddresses']),
    socialProfiles:
      (intData.socialProfiles as ExternalIntegrations['socialProfiles']) ||
      (row.social_profiles as ExternalIntegrations['socialProfiles']),
  }
}

/**
 * Resolve user profile by username (request-cached).
 * Never returns `email` (defense in depth — owners use getUserById for self).
 * Always run `projectPublicPersonalPage` before rendering section data to strangers.
 */
export const getUserByUsername = cache(async (username: string): Promise<AuthUser | null> => {
  const usernameKey = username.trim().toLowerCase()
  if (!usernameKey) return null

  try {
    const result = await db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      filters: [{ field: 'username', operator: '=', value: usernameKey }],
      pagination: { limit: 1 },
    })

    if (!result.success || result.data.length === 0) return null

    const row = result.data[0]
    const communication = mapCommunication(row)
    const cultural = mapCultural(row)
    const integrations = mapIntegrations(row)
    const skills = Array.isArray(row.skills) ? (row.skills as string[]) : undefined

    const commExtra = (row.communication as Record<string, unknown> | undefined) || {}
    if (communication) {
      if (typeof commExtra.viberNumber === 'string') {
        ;(communication as CommunicationChannels & { viberNumber?: string }).viberNumber =
          commExtra.viberNumber
      }
      if (typeof commExtra.signalNumber === 'string') {
        ;(communication as CommunicationChannels & { signalNumber?: string }).signalNumber =
          commExtra.signalNumber
      }
    }

    return {
      id: row.id as string,
      // Email intentionally omitted on username lookup (public surface)
      email: '',
      emailVerified: null,
      name: (row.name as string) ?? null,
      username: row.username as string,
      role: resolvePersistedUserRole(row.role),
      photoURL: (row.photoURL as string) ?? (row.image as string) ?? null,
      wallets: (row.wallets as AuthUser['wallets']) ?? [],
      authProvider: (row.authProvider as string) || 'credentials',
      authProviderId: (row.authProviderId as string) || (row.id as string),
      isVerified: (row.isVerified as boolean) ?? false,
      createdAt: new Date((row.createdAt as string) || Date.now()),
      lastLogin: new Date((row.lastLogin as string) || Date.now()),
      bio: row.bio as string | undefined,
      publicProfile:
        row.publicProfile === true ||
        row.publicProfile === 'true' ||
        row.publicProfile === 1 ||
        row.publicProfile === '1',
      publicProfileSections: Array.isArray(row.publicProfileSections)
        ? (row.publicProfileSections as string[])
        : undefined,
      publicProfileFields: normalizePublicProfileFields(row.publicProfileFields),
      acceptProfileDms: acceptsProfileDms(row.acceptProfileDms),
      communication,
      cultural,
      integrations,
      phoneNumber: (row.phoneNumber as string | undefined) || communication?.phoneNumber,
      organization: row.organization as string | undefined,
      position: row.position as string | undefined,
      skills,
      canPostconfidentialOpportunities:
        (row.canPostconfidentialOpportunities as boolean) ?? false,
      canViewconfidentialOpportunities:
        (row.canViewconfidentialOpportunities as boolean) ?? false,
      postedopportunities: (row.postedopportunities as string[]) ?? [],
      savedopportunities: (row.savedopportunities as string[]) ?? [],
      nonce: row.nonce as string | undefined,
      nonceExpires: row.nonceExpires as number | undefined,
      notificationPreferences: (row.notificationPreferences as AuthUser['notificationPreferences']) ?? {
        email: true,
        inApp: true,
        sms: false,
      },
      settings: (row.settings as AuthUser['settings']) ?? {
        language: DEFAULT_LOCALE,
        theme: getDefaultTheme(),
        notifications: true,
        notificationPreferences: { email: true, inApp: true, sms: false },
      },
    } as unknown as AuthUser
  } catch (error) {
    console.error('getUserByUsername: Error:', error)
    return null
  }
})

export type PublicPersonalPageUser = {
  id: string
  name?: string | null
  username?: string | null
  photoURL?: string | null
  role?: AuthUser['role']
  bio?: string
  publicProfile?: boolean
  publicProfileSections?: string[]
  publicProfileFields?: PublicProfileFieldsMap
  acceptProfileDms?: boolean
  communication?: CommunicationChannels & {
    viberNumber?: string
    signalNumber?: string
  }
  cultural?: Pick<CulturalContext, 'country' | 'timezone' | 'languages'>
  integrations?: {
    socialProfiles?: {
      linkedin?: string
      twitter?: string
    }
  }
  phoneNumber?: string
  organization?: string
  position?: string
  skills?: string[]
  isVerified?: boolean
}

/**
 * Privacy projection for public personal page rendering.
 * - Identity-only when `publicProfile` is false
 * - Section + field gates from Page Builder
 * - Never includes email
 */
export function projectPublicPersonalPage(user: AuthUser): PublicPersonalPageUser {
  const sections = normalizePersonalPageSections(user.publicProfileSections)
  const fields = normalizePublicProfileFields(user.publicProfileFields)
  const fieldOn = (section: PersonalPageSectionId, field: string) =>
    personalPageFieldEnabled(fields, section, field)

  const base: PublicPersonalPageUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    photoURL: user.photoURL,
    role: user.role,
    publicProfile: user.publicProfile,
    publicProfileSections: sections,
    publicProfileFields: fields,
    acceptProfileDms: acceptsProfileDms(user.acceptProfileDms),
    isVerified: user.isVerified,
  }

  if (!user.publicProfile) {
    return base
  }

  const enabled = (id: PersonalPageSectionId) => personalPageSectionEnabled(sections, id)

  if (enabled('bio') && fieldOn('bio', 'text')) {
    base.bio = user.bio
  }

  if (enabled('messengers') && user.communication) {
    const c = user.communication as CommunicationChannels & {
      viberNumber?: string
      signalNumber?: string
    }
    const telegram = fieldOn('messengers', 'telegram')
      ? {
          telegramUsername: c.telegramUsername,
          telegramId: c.telegramId,
        }
      : {}
    const whatsapp =
      fieldOn('messengers', 'whatsapp') && c.whatsappNumber
        ? { whatsappNumber: c.whatsappNumber }
        : {}
    const viber =
      fieldOn('messengers', 'viber') && c.viberNumber ? { viberNumber: c.viberNumber } : {}
    const signal =
      fieldOn('messengers', 'signal') && c.signalNumber
        ? { signalNumber: c.signalNumber }
        : {}
    const hasAny =
      Boolean(
        ('telegramUsername' in telegram && telegram.telegramUsername) ||
          ('telegramId' in telegram && telegram.telegramId) ||
          whatsapp.whatsappNumber ||
          viber.viberNumber ||
          signal.signalNumber,
      )
    if (hasAny) {
      base.communication = {
        preferredContactMethod: c.preferredContactMethod || 'telegram',
        ...telegram,
        ...whatsapp,
        ...viber,
        ...signal,
      }
    }
  }

  if (enabled('professional')) {
    if (fieldOn('professional', 'organization')) base.organization = user.organization
    if (fieldOn('professional', 'position')) base.position = user.position
    if (fieldOn('professional', 'skills')) base.skills = user.skills
    const social = user.integrations?.socialProfiles as
      | { linkedin?: string; twitter?: string }
      | undefined
    if (social) {
      const linkedin = fieldOn('professional', 'linkedin') ? social.linkedin : undefined
      const twitter = fieldOn('professional', 'twitter') ? social.twitter : undefined
      if (linkedin || twitter) {
        base.integrations = {
          socialProfiles: {
            ...(linkedin ? { linkedin } : {}),
            ...(twitter ? { twitter } : {}),
          },
        }
      }
    }
  }

  if (enabled('location') && user.cultural) {
    const country = fieldOn('location', 'country')
      ? user.cultural.country?.trim() || undefined
      : undefined
    const timezone = fieldOn('location', 'timezone')
      ? user.cultural.timezone?.trim() || undefined
      : undefined
    if (country || (timezone && timezone !== 'UTC')) {
      base.cultural = {
        country,
        timezone: timezone || 'UTC',
        languages: [],
      }
    }
  }

  if (enabled('contact') && fieldOn('contact', 'phone')) {
    base.phoneNumber = user.phoneNumber || user.communication?.phoneNumber
  }

  return base
}
