import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import type { AuthUser } from '@/features/auth/types'
import type { Locale } from '@/i18n/shared'
import {
  PrivateProfileShell,
  buildPrivateProfileShellProps,
} from '@/features/auth/components/private-profile-shell'
import {
  personalPageMediaVisible,
  normalizePublicProfileMedia,
  type PersonalPageMediaId,
} from '@/features/auth/lib/personal-page-sections'
import { recordPrivateProfileView } from '@/features/analytics/lib/personal-page-analytics'

type SessionLike = Parameters<typeof buildPrivateProfileShellProps>[0]['session']

type GateSurface = 'profile' | PersonalPageMediaId

/**
 * When the surface is not visible, return PrivateProfileShell (+ private_profile_view).
 * - profile: gated by master `publicProfile`
 * - player/games/gallery: gated by `personalPageMediaVisible` (pin or inherit master)
 */
export async function maybePrivatePersonalPageShell(input: {
  user: AuthUser
  session: SessionLike
  locale: Locale
  username: string
  surface?: GateSurface
}): Promise<ReactNode> {
  const surface = input.surface ?? 'profile'
  const media = normalizePublicProfileMedia(
    (input.user as AuthUser & { publicProfileMedia?: unknown }).publicProfileMedia,
  )
  const master = Boolean(input.user.publicProfile)

  const visible =
    surface === 'profile'
      ? master
      : personalPageMediaVisible(media, surface, master)

  if (visible) return null

  const profileUsername = input.user.username || input.username
  if (!(input.session?.user?.id && input.session.user.id === input.user.id)) {
    void recordPrivateProfileView({
      username: profileUsername,
      profileUserId: input.user.id,
      locale: input.locale,
      path: `/${input.locale}/${profileUsername}${surface === 'profile' ? '' : `/${surface === 'gallery' ? 'img' : surface}`}`,
      surface: surface === 'gallery' ? 'img' : surface,
    }).catch(() => undefined)
  }

  return <PrivateProfileShell {...(await buildPrivateProfileShellProps(input))} />
}

/** Metadata robots when personal page / media surface is private. */
export function privatePersonalPageRobots(): Pick<Metadata, 'robots'> {
  return { robots: { index: false, follow: false } }
}
