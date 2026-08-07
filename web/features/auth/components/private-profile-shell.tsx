import Link from 'next/link'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/i18n/shared'
import type { AuthUser } from '@/features/auth/types'
import {
  hasRoleAtLeast,
  resolveSessionUserRole,
  UserRolesArray,
} from '@/features/auth/user-role'
import { acceptsProfileDms } from '@/features/auth/lib/personal-page-sections'
import { isDirectMessagingBlockedBetween } from '@/features/auth/services/user-blocklist-lib'
import UserProfileWrapper from '@/components/wrappers/user-profile-wrapper'
import { ContactForm } from '@/components/common/widgets/contact-form'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'
import { davinciGlassSurface } from '@/lib/ui/davinci'

export type PrivateProfileShellProps = {
  locale: Locale
  username: string
  profileUserId: string
  isOwner: boolean
  canContact: boolean
  /** Recipient accepts profile DMs — gates guest sign-in CTA too. */
  acceptProfileDms: boolean
  isAuthenticated: boolean
  visitorName: string
  visitorEmail: string
}

/** Non-public shell: @username (+ subscriber contact → owner DM). */
export async function PrivateProfileShell({
  locale,
  username,
  profileUserId,
  isOwner,
  canContact,
  acceptProfileDms,
  isAuthenticated,
  visitorName,
  visitorEmail,
}: PrivateProfileShellProps) {
  const t = await getTranslations('modules.profile')
  const showSignInCta = !isAuthenticated && acceptProfileDms

  return (
    <UserProfileWrapper locale={locale} username={username}>
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <div className={cn(davinciGlassSurface, 'space-y-5 p-5 sm:p-6')}>
          <div>
            <p className="text-sm text-muted-foreground">
              {t('privateProfileLabel') || 'Personal page'}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              @{username}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {isOwner
                ? t('privateProfileOwnerHint') ||
                  'You are previewing your private page. Enable Personal page in Profile to publish it.'
                : t('privateProfileHint') ||
                  'This member keeps their personal page private.'}
            </p>
          </div>

          {isOwner ? (
            <Button asChild variant="outline" size="sm">
              <Link href={ROUTES.PROFILE(locale)}>
                {t('privateProfileOpenSettings') || 'Open Profile settings'}
              </Link>
            </Button>
          ) : canContact ? (
            <div className="space-y-3 border-t border-border/40 pt-4">
              <h2 className="text-base font-semibold">
                {t('privateProfileContactTitle') || 'Send a message'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('privateProfileContactHint') ||
                  'Your message is delivered to their Ring Messages inbox.'}
              </p>
              <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
                <ContactForm
                  entityId={`user:${profileUserId}`}
                  entityName={username}
                  deliveryMode="direct_message"
                  recipientUserId={profileUserId}
                  initialUserInfo={{
                    name: visitorName,
                    email: visitorEmail,
                  }}
                />
              </Suspense>
            </div>
          ) : showSignInCta ? (
            <div className="space-y-3 border-t border-border/40 pt-4">
              <p className="text-sm text-muted-foreground">
                {t('privateProfileSignIn') ||
                  'Sign in as a subscriber to contact this member.'}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.LOGIN(locale)}>
                  {t('privateProfileSignInCta') || 'Sign in'}
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </UserProfileWrapper>
  )
}

type SessionLike = {
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    role?: string
  } | null
} | null

/** Shared gate for main + player/games/img when personal page / media surface is off. */
export async function buildPrivateProfileShellProps(input: {
  user: AuthUser
  session: SessionLike
  locale: Locale
  username: string
}): Promise<PrivateProfileShellProps> {
  const { user, session, locale, username } = input
  const isOwner = Boolean(session?.user?.id && session.user.id === user.id)
  const visitorRole = resolveSessionUserRole(session?.user?.role as string)
  const dmsOk = acceptsProfileDms(
    (user as AuthUser & { acceptProfileDms?: unknown }).acceptProfileDms,
  )

  let blocked = false
  if (session?.user?.id && !isOwner) {
    blocked = await isDirectMessagingBlockedBetween(session.user.id, user.id)
  }

  const canContact =
    Boolean(session?.user?.id) &&
    !isOwner &&
    dmsOk &&
    !blocked &&
    hasRoleAtLeast(visitorRole, UserRolesArray.subscriber)

  return {
    locale,
    username: user.username || username,
    profileUserId: user.id,
    isOwner,
    canContact,
    acceptProfileDms: dmsOk && !blocked,
    isAuthenticated: Boolean(session?.user?.id),
    visitorName: session?.user?.name || '',
    visitorEmail: session?.user?.email || '',
  }
}
