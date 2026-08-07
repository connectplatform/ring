'use client'

import { useMemo, useState } from 'react'
import { useConnect, useConnectors, type Connector } from 'wagmi'
import { useTranslations } from 'next-intl'
import { Loader2, Wallet } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/use-media-query'
import { toast } from '@/hooks/use-toast'
import {
  getConnectorDisplayInfo,
  normalizeConnectorIconSrc,
  sortConnectorsForDevice,
} from '@/lib/web3/connector-display'

function dedupeConnectors(connectors: readonly Connector[]) {
  const seen = new Set<string>()
  return connectors.filter((c) => {
    const key = c.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function ConnectorIcon({ connector }: { connector: Connector }) {
  const src = normalizeConnectorIconSrc(connector.icon)
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- EIP-6963 data URIs from wallets; trim required
      <img
        src={src}
        alt=""
        width={24}
        height={24}
        className="h-6 w-6 shrink-0 rounded-sm object-contain"
      />
    )
  }
  return <Wallet className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
}

export interface ConnectorPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectorPickerDialog({ open, onOpenChange }: ConnectorPickerDialogProps) {
  const t = useTranslations('modules.auth.walletConnect.picker')
  const isMobile = useMediaQuery('(max-width: 767px)')
  const connectors = useConnectors()
  const connect = useConnect()
  const [localError, setLocalError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const list = useMemo(() => {
    const deduped = dedupeConnectors(connectors)
    return sortConnectorsForDevice(deduped, isMobile)
  }, [connectors, isMobile])

  const displayError = localError ?? connect.error?.message ?? null

  const handleConnect = (connector: Connector) => {
    setLocalError(null)
    setPendingId(connector.id)

    if (connector.id.toLowerCase().includes('walletconnect')) {
      onOpenChange(false)
    }

    connect.mutate(
      { connector },
      {
        onSuccess: () => {
          setLocalError(null)
          setPendingId(null)
          onOpenChange(false)
        },
        onError: (err) => {
          setPendingId(null)
          const message = err instanceof Error ? err.message : t('errors.failed')
          setLocalError(message)
          toast({
            title: t('errors.failed'),
            description: message,
            variant: 'destructive',
          })
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setLocalError(null)
          setPendingId(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{t('noWalletDetected')}</p>
          ) : (
            list.map((connector) => {
              const { label } = getConnectorDisplayInfo(connector)
              const isThisPending = connect.isPending && pendingId === connector.id

              return (
                <Button
                  key={connector.id}
                  type="button"
                  variant="outline"
                  className="justify-start gap-3 h-12"
                  disabled={connect.isPending}
                  onClick={() => handleConnect(connector)}
                >
                  <ConnectorIcon connector={connector} />
                  <span className="flex-1 text-left">{label}</span>
                  {isThisPending ? (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                  ) : null}
                </Button>
              )
            })
          )}
        </div>
        {displayError ? (
          <p className="text-sm text-destructive" role="alert">
            {displayError}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
