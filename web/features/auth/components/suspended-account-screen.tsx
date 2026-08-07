'use client'

import { useEffect, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, ShieldAlert, Video } from 'lucide-react'
import { VIDEO_VERIFICATION_CHANNELS } from '@/features/auth/types/account-restore'

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  email_zoom: 'Email + Zoom',
  email_hangouts: 'Email + Google Meet / Hangouts',
  skype: 'Skype',
}

export function SuspendedAccountScreen() {
  const t = useTranslations('modules.account.suspended')
  const { data: session } = useSession()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [existingProcedure, setExistingProcedure] = useState<string | null>(null)

  const [email, setEmail] = useState(session?.user?.email ?? '')
  const [phoneNumber, setPhoneNumber] = useState(
    (session?.user as { phoneNumber?: string })?.phoneNumber ?? '',
  )
  const [telegramUsername, setTelegramUsername] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [preferredVideoChannel, setPreferredVideoChannel] = useState<string>('telegram')
  const [message, setMessage] = useState('')

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/account/restore-request')
        if (!res.ok) return
        const data = await res.json()
        if (data.procedure?.procedureNumber) {
          setExistingProcedure(data.procedure.procedureNumber)
        }
      } catch {
        // ignore
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/account/restore-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email || undefined,
            phoneNumber: phoneNumber || undefined,
            telegramUsername: telegramUsername || undefined,
            whatsappNumber: whatsappNumber || undefined,
            preferredVideoChannel,
            message,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || t('submitError'))
        }
        setExistingProcedure(data.procedureNumber)
        setSuccess(t('submitSuccess', { procedure: data.procedureNumber }))
      } catch (err) {
        setError(err instanceof Error ? err.message : t('submitError'))
      }
    })
  }

  const suspensionReason = (session?.user as { suspensionReason?: string })?.suspensionReason

  return (
    <Card className="w-full max-w-lg border-destructive/30 shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {suspensionReason && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('reasonLabel')}: {suspensionReason}
            </AlertDescription>
          </Alert>
        )}

        {existingProcedure ? (
          <Alert>
            <Video className="h-4 w-4" />
            <AlertDescription>
              {t('pendingReview', { procedure: existingProcedure })}
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('formIntro')}</p>

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telegram">{t('telegram')}</Label>
                <Input
                  id="telegram"
                  placeholder="@username"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">{t('whatsapp')}</Label>
                <Input
                  id="whatsapp"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('videoChannel')}</Label>
              <Select value={preferredVideoChannel} onValueChange={setPreferredVideoChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_VERIFICATION_CHANNELS.map((ch) => (
                    <SelectItem key={ch} value={ch}>
                      {CHANNEL_LABELS[ch] ?? ch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('videoChannelHelp')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">{t('message')}</Label>
              <Textarea
                id="message"
                required
                minLength={10}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('messagePlaceholder')}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? t('submitting') : t('submit')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
