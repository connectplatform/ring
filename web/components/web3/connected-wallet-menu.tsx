'use client'

import { useState } from 'react'
import {
  useChains,
  useChainId,
  useConnection,
  useDisconnect,
  useSwitchChain,
} from 'wagmi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Wallet } from 'lucide-react'

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export type ConnectedWalletMenuVariant = 'default' | 'compact'

export interface ConnectedWalletMenuProps {
  /** default: chain + account controls; compact: single trigger (e.g. dashboard header) */
  variant?: ConnectedWalletMenuVariant
}

export function ConnectedWalletMenu({ variant = 'default' }: ConnectedWalletMenuProps) {
  const { address, chain, isConnected } = useConnection()
  const chains = useChains()
  const currentChainId = useChainId()
  const disconnect = useDisconnect()
  const switchChain = useSwitchChain()
  const [chainDialogOpen, setChainDialogOpen] = useState(false)

  const configuredIds = new Set(chains.map((c) => c.id))
  const unsupported = isConnected && chain != null && !configuredIds.has(chain.id)

  const openChainPicker = () => setChainDialogOpen(true)

  const copyAddress = () => {
    if (address) void navigator.clipboard.writeText(address)
  }

  if (!isConnected || !address) {
    return null
  }

  const chainLabel = chain?.name ?? 'Network'

  const chainPicker = (
    <Dialog open={chainDialogOpen} onOpenChange={setChainDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch network</DialogTitle>
          <DialogDescription>Select a chain configured for this app.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2 max-h-[60vh] overflow-y-auto">
          {chains.map((c) => (
            <Button
              key={c.id}
              type="button"
              variant={currentChainId === c.id ? 'default' : 'outline'}
              className="justify-start"
              disabled={switchChain.isPending}
              onClick={() => {
                switchChain.mutate(
                  { chainId: c.id },
                  { onSuccess: () => setChainDialogOpen(false) }
                )
              }}
            >
              {c.name}
            </Button>
          ))}
        </div>
        {switchChain.error ? (
          <p className="text-sm text-destructive" role="alert">
            {switchChain.error.message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )

  if (unsupported) {
    return (
      <>
        <Button
          type="button"
          variant="destructive"
          onClick={openChainPicker}
          className="font-medium"
        >
          Wrong network
        </Button>
        {chainPicker}
      </>
    )
  }

  if (variant === 'compact') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {truncateAddress(address)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
              {chainLabel}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={copyAddress}>Copy address</DropdownMenuItem>
            <DropdownMenuItem onSelect={openChainPicker}>Switch network</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => disconnect.mutate()}
              className="text-destructive focus:text-destructive"
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {chainPicker}
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={openChainPicker}
          className="font-medium"
        >
          {chainLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="font-medium">
              {truncateAddress(address)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
              Connected
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={copyAddress}>Copy address</DropdownMenuItem>
            <DropdownMenuItem onSelect={openChainPicker}>Switch network</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => disconnect.mutate()}
              className="text-destructive focus:text-destructive"
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {chainPicker}
    </>
  )
}
