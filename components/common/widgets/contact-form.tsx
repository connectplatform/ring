'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { submitContactForm, ContactFormState } from '@/app/_actions/crm-contact'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export type ContactFormDeliveryMode = 'crm' | 'direct_message'

interface ContactFormProps {
  entityId: string
  entityName: string
  initialUserInfo: {
    name: string
    email: string
  }
  /** Default `crm` (platform /contact + entity). `direct_message` DMs `recipientUserId`. */
  deliveryMode?: ContactFormDeliveryMode
  /** Required when deliveryMode is direct_message — profile/page owner. */
  recipientUserId?: string
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  )
}

export function ContactForm({
  entityId,
  entityName,
  initialUserInfo,
  deliveryMode = 'crm',
  recipientUserId,
}: ContactFormProps) {
  const t = useTranslations('contact.form')
  const locale = useLocale() as Locale
  const [state, formAction] = useActionState<ContactFormState | null, FormData>(
    submitContactForm,
    null,
  )

  if (state?.success) {
    const messagesHref = state.conversationId
      ? `${ROUTES.MESSAGES(locale)}?c=${encodeURIComponent(state.conversationId)}`
      : null
    const successText =
      state.successKey === 'messageSent'
        ? t('messageSent')
        : state.successKey === 'thankYou'
          ? t('success')
          : state.message || t('success')

    return (
      <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200">
        <AlertDescription className="space-y-3 text-center">
          <p className="text-xl">{successText}</p>
          {messagesHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={messagesHref}>{t('openMessages')}</Link>
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="entityName" value={entityName} />
      <input type="hidden" name="deliveryMode" value={deliveryMode} />
      {recipientUserId ? (
        <input type="hidden" name="recipientUserId" value={recipientUserId} />
      ) : null}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {state.errorKey === 'notAcceptingMessages'
              ? t('notAcceptingMessages')
              : state.error}
          </AlertDescription>
        </Alert>
      )}

      {!initialUserInfo.name && (
        <div>
          <Label htmlFor="name" className="mb-1 block">
            {t('name')}
          </Label>
          <Input id="name" name="name" required />
        </div>
      )}

      {initialUserInfo.name && (
        <input type="hidden" name="name" value={initialUserInfo.name} />
      )}

      {!initialUserInfo.email && (
        <div>
          <Label htmlFor="email" className="mb-1 block">
            {t('email')}
          </Label>
          <Input id="email" name="email" type="email" required />
        </div>
      )}

      {initialUserInfo.email && (
        <input type="hidden" name="email" value={initialUserInfo.email} />
      )}

      <div>
        <Label htmlFor="message" className="mb-1 block">
          {t('message')}
        </Label>
        <Textarea id="message" name="message" rows={4} required />
      </div>

      <SubmitButton label={t('send')} pendingLabel={t('sending')} />
    </form>
  )
}
