'use client'

import { useMemo } from 'react'
import { useConnect, useConnectors, type Connector } from 'wagmi'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function dedupeConnectors(connectors: readonly Connector[]) {
  const seen = new Set<string>()
  return connectors.filter((c) => {
    const key = c.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export interface ConnectorPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectorPickerDialog({ open, onOpenChange }: ConnectorPickerDialogProps) {
  const connectors = useConnectors()
  const connect = useConnect()
  const list = useMemo(() => dedupeConnectors(connectors), [connectors])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect wallet</DialogTitle>
          <DialogDescription>
            Choose a wallet. Injected wallets may appear as one entry per browser extension.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          {list.map((connector) => (
            <Button
              key={connector.id}
              type="button"
              variant="outline"
              className="justify-start"
              disabled={!connector.ready || connect.isPending}
              onClick={() => {
                connect.mutate(
                  { connector },
                  {
                    onSuccess: () => onOpenChange(false),
                  }
                )
              }}
            >
              {connector.name}
            </Button>
          ))}
        </div>
        {connect.error ? (
          <p className="text-sm text-destructive" role="alert">
            {connect.error.message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
