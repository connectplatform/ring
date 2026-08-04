'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { KeyRound, Loader2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react'
import type { Message, EnvRequestMetadata } from '@/features/chat/types'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'

function parseEnvRequest(message: Message): EnvRequestMetadata | null {
  const meta = message.metadata
  if (meta && meta.kind === 'env_request' && Array.isArray(meta.keys)) {
    return meta as unknown as EnvRequestMetadata
  }
  if (message.type !== 'env_request') return null
  return {
    kind: 'env_request',
    keys: [],
    status: 'pending',
    requesterUserId: message.senderId,
    orderId: '',
  }
}

export function EnvRequestMessageWidget({
  message,
  isOwn,
  className,
}: {
  message: Message
  isOwn: boolean
  className?: string
}) {
  const locale = (useLocale() as Locale) || 'en'
  const [localMeta, setLocalMeta] = useState<Partial<EnvRequestMetadata> | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const base = parseEnvRequest(message)
  const request = useMemo(() => {
    if (!base) return null
    return { ...base, ...localMeta } as EnvRequestMetadata
  }, [base, localMeta])

  if (!request) {
    return <div className="whitespace-pre-wrap">{message.content}</div>
  }

  const status = request.status
  const canCancel = isOwn && status === 'pending'
  const secretsHref = request.orderId
    ? `${ROUTES.MY_ORDER(request.orderId, locale)}#secrets`
    : null
  const docsHref = request.docsPath || '/docs/backend/firebase'

  const handleCancel = async () => {
    try {
      setCancelling(true)
      const { ok, data, error: parseErr } = await fetchJsonSafe<{ error?: string }>(
        '/api/my-jobs/env-request/cancel',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: message.id }),
        },
      )
      if (!ok || !data) throw new Error(parseErr || data?.error || 'Cancel failed')
      if (data.error) throw new Error(data.error)
      setLocalMeta({ status: 'cancelled', cancelledAt: new Date().toISOString() })
      toast({ title: 'Cancelled', description: 'Key update request cancelled' })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Cancel failed',
        variant: 'destructive',
      })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className={cn('space-y-2 rounded-md border bg-background/80 p-3 text-foreground', className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <KeyRound className="h-4 w-4 text-amber-600" />
        Key update request
        {status === 'fulfilled' ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : status === 'cancelled' ? (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Status: {status}</p>
      <ul className="max-h-28 list-inside list-disc overflow-auto font-mono text-xs">
        {(request.keys || []).map((k) => (
          <li key={k}>{k}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {!isOwn && status === 'pending' && secretsHref ? (
          <Button asChild size="sm">
            <Link href={secretsHref}>Open secrets</Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <a href={docsHref} rel="noreferrer" target="_blank">
            <ExternalLink className="mr-1 h-3 w-3" />
            Docs
          </a>
        </Button>
        {canCancel ? (
          <Button disabled={cancelling} size="sm" variant="ghost" onClick={() => void handleCancel()}>
            {cancelling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}
