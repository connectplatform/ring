import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { PublicPersonalPageUser } from '@/features/auth/services/get-user-by-username'
import {
  acceptsProfileDms,
  personalPageSectionEnabled,
  type PersonalPageSectionId,
} from '@/features/auth/lib/personal-page-sections'
import { ContactForm } from '@/components/common/widgets/contact-form'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { davinciGlassSurface } from '@/lib/ui/davinci'

type MessengerExtra = {
  viberNumber?: string
  signalNumber?: string
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function hasSectionContent(
  user: PublicPersonalPageUser,
  id: PersonalPageSectionId,
): boolean {
  switch (id) {
    case 'bio':
      return Boolean(user.bio?.trim())
    case 'messengers': {
      const c = user.communication as (typeof user.communication & MessengerExtra) | undefined
      return Boolean(
        c?.telegramUsername ||
          c?.telegramId ||
          c?.whatsappNumber ||
          c?.viberNumber ||
          c?.signalNumber,
      )
    }
    case 'professional':
      return Boolean(
        user.organization ||
          user.position ||
          (Array.isArray(user.skills) && user.skills.length > 0) ||
          user.integrations?.socialProfiles?.linkedin ||
          user.integrations?.socialProfiles?.twitter,
      )
    case 'location':
      return Boolean(
        user.cultural?.country ||
          (user.cultural?.timezone && user.cultural.timezone !== 'UTC'),
      )
    case 'contact':
      return Boolean(user.phoneNumber)
    default:
      return false
  }
}

function SectionShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

export async function PublicProfileSections({
  user,
  canContact,
  isOwner,
  isAuthenticated,
  visitorPreview,
  visitorName,
  visitorEmail,
  signInHref,
}: {
  user: PublicPersonalPageUser
  canContact: boolean
  isOwner: boolean
  isAuthenticated: boolean
  visitorPreview?: boolean
  visitorName: string
  visitorEmail: string
  signInHref: string
}) {
  const t = await getTranslations('modules.profile')
  const sections = user.publicProfileSections
  const show = (id: PersonalPageSectionId) => personalPageSectionEnabled(sections, id)
  const dmsOk = acceptsProfileDms(user.acceptProfileDms)

  const messengers = user.communication as
    | (NonNullable<PublicPersonalPageUser['communication']> & MessengerExtra)
    | undefined

  // Never invite sign-in / form preview when recipient opted out of profile DMs
  const showContactSignIn =
    show('contact') && dmsOk && !isOwner && !isAuthenticated && !visitorPreview
  const showContactPreview = show('contact') && dmsOk && Boolean(visitorPreview)
  const showContactBlock =
    show('contact') &&
    (Boolean(user.phoneNumber) || canContact || showContactSignIn || showContactPreview)

  return (
    <div className="mt-8 space-y-4">
      {show('bio') && user.bio ? (
        <SectionShell title={t('bio') || 'Bio'}>
          <p className="max-w-2xl whitespace-pre-wrap text-muted-foreground">{user.bio}</p>
        </SectionShell>
      ) : null}

      {show('messengers') && hasSectionContent(user, 'messengers') ? (
        <SectionShell title={t('messengers') || 'Messengers'}>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {messengers?.telegramUsername ? (
              <li>
                {t('messengerTelegram') || 'Telegram'}:{' '}
                <a
                  className="text-foreground underline-offset-2 hover:underline"
                  href={`https://t.me/${messengers.telegramUsername.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{messengers.telegramUsername.replace(/^@/, '')}
                </a>
              </li>
            ) : messengers?.telegramId ? (
              <li>
                {t('messengerTelegram') || 'Telegram'}:{' '}
                {t('messengerTelegramLinked') || 'linked'}
              </li>
            ) : null}
            {messengers?.whatsappNumber ? (
              <li>
                {t('messengerWhatsapp') || 'WhatsApp'}:{' '}
                <a
                  className="text-foreground underline-offset-2 hover:underline"
                  href={`https://wa.me/${digitsOnly(messengers.whatsappNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {messengers.whatsappNumber}
                </a>
              </li>
            ) : null}
            {messengers?.viberNumber ? (
              <li>
                {t('messengerViber') || 'Viber'}: {messengers.viberNumber}
              </li>
            ) : null}
            {messengers?.signalNumber ? (
              <li>
                {t('messengerSignal') || 'Signal'}: {messengers.signalNumber}
              </li>
            ) : null}
          </ul>
        </SectionShell>
      ) : null}

      {show('professional') && hasSectionContent(user, 'professional') ? (
        <SectionShell title={t('professionalProfile') || 'Professional Profile'}>
          <div className="space-y-1 text-sm text-muted-foreground">
            {user.organization ? (
              <p>
                <span className="text-foreground">{user.organization}</span>
                {user.position ? ` · ${user.position}` : ''}
              </p>
            ) : user.position ? (
              <p>{user.position}</p>
            ) : null}
            {user.integrations?.socialProfiles?.linkedin ? (
              <p>
                <a
                  className="text-foreground underline-offset-2 hover:underline"
                  href={user.integrations.socialProfiles.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
              </p>
            ) : null}
            {user.integrations?.socialProfiles?.twitter ? (
              <p>
                <a
                  className="text-foreground underline-offset-2 hover:underline"
                  href={
                    user.integrations.socialProfiles.twitter.startsWith('http')
                      ? user.integrations.socialProfiles.twitter
                      : `https://twitter.com/${user.integrations.socialProfiles.twitter.replace(/^@/, '')}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  X / Twitter
                </a>
              </p>
            ) : null}
            {Array.isArray(user.skills) && user.skills.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {user.skills.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-md border border-border/60 px-2 py-0.5 text-xs text-foreground"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </SectionShell>
      ) : null}

      {show('location') && hasSectionContent(user, 'location') ? (
        <SectionShell title={t('location') || 'Location'}>
          <p className="text-sm text-muted-foreground">
            {[user.cultural?.country, user.cultural?.timezone].filter(Boolean).join(' · ')}
          </p>
        </SectionShell>
      ) : null}

      {showContactBlock ? (
        <SectionShell title={t('contactData') || 'Contact Data'}>
          {user.phoneNumber ? (
            <p className="text-sm text-muted-foreground">{user.phoneNumber}</p>
          ) : null}
          {canContact ? (
            <div className="mt-4 max-w-lg space-y-2">
              <p className="text-xs text-muted-foreground">
                {t('privateProfileContactHint') ||
                  'Your message is delivered to their Ring Messages inbox.'}
              </p>
              <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
                <ContactForm
                  entityId={`user:${user.id}`}
                  entityName={user.username || ''}
                  deliveryMode="direct_message"
                  recipientUserId={user.id}
                  initialUserInfo={{
                    name: visitorName,
                    email: visitorEmail,
                  }}
                />
              </Suspense>
            </div>
          ) : showContactPreview ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t('contactFormVisitorPreview') ||
                'Subscribers see a contact form here to message you in Ring Messages.'}
            </p>
          ) : showContactSignIn ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('privateProfileSignIn') ||
                  'Sign in as a subscriber to contact this member.'}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href={signInHref}>
                  {t('privateProfileSignInCta') || 'Sign in'}
                </Link>
              </Button>
            </div>
          ) : null}
        </SectionShell>
      ) : null}
    </div>
  )
}
