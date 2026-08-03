import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import type { AuthUser } from '@/features/auth/types'
import type { Locale } from '@/i18n/shared'
import {
  PrivateProfileShell,
  buildPrivateProfileShellProps,
} from '@/features/auth/components/private-profile-shell'

type SessionLike = Parameters<typeof buildPrivateProfileShellProps>[0]['session']

/** When personal page is off, return PrivateProfileShell element; otherwise null. */
export function maybePrivatePersonalPageShell(input: {
  user: AuthUser
  session: SessionLike
  locale: Locale
  username: string
}): ReactNode {
  if (input.user.publicProfile) return null
  return <PrivateProfileShell {...buildPrivateProfileShellProps(input)} />
}

/** Metadata robots when personal page is private. */
export function privatePersonalPageRobots(): Pick<Metadata, 'robots'> {
  return { robots: { index: false, follow: false } }
}
