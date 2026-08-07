'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface WalletFsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  className?: string
}

/** Fullscreen-friendly dialog shell shared by wallet send / desk / add-credit flows. */
export default function WalletFsModal({
  open,
  onOpenChange,
  title,
  children,
  className,
}: WalletFsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[100dvh] flex-col gap-0 overflow-hidden p-0',
          'max-sm:min-h-[100dvh] max-sm:rounded-none max-sm:pt-10 sm:max-w-lg',
          className,
        )}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
          <DialogTitle className="text-left text-base sm:text-lg">{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
