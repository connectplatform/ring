'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Above mobile bottom nav (`z-[9000]`) and floating profile avatar (`z-[8500]`).
 * Matches diagram-viewer / rocket-journey fullscreen SSOT.
 */
export const FS_MODAL_Z = 9200

export interface FsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Optional header subtitle. Omit when the body carries the description. */
  description?: string
  children: React.ReactNode
  /** Optional bottom bar. Omit to stack actions inside children (no separator). */
  footer?: React.ReactNode
  className?: string
  contentClassName?: string
  headerClassName?: string
  footerClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  /** Hide header bottom border (default false). */
  hideHeaderSeparator?: boolean
  /** Hide footer top border (default false). */
  hideFooterSeparator?: boolean
  /**
   * On mobile, keep title for a11y (`sr-only`) but free vertical space.
   * Description (if set) stays visible unless `descriptionClassName` hides it.
   */
  hideTitleOnMobile?: boolean
}

/**
 * Fullscreen-friendly dialog shell (mobile edge-to-edge; sm+ centered card).
 * Shared by wallet / avatar crop / generative editors / Telegram link / profile editors.
 *
 * Theme: close control uses DaVinci `.modal-close-button` (see styles/davinci.css).
 * Z-index: overlay + panel at {@link FS_MODAL_Z} so chrome cannot cover the modal.
 */
export function FsModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  headerClassName,
  footerClassName,
  titleClassName,
  descriptionClassName,
  hideHeaderSeparator = false,
  hideFooterSeparator = false,
  hideTitleOnMobile = false,
}: FsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Literal z-[9200] required for Tailwind JIT (see FS_MODAL_Z).
        overlayClassName="z-[9200]"
        className={cn(
          'z-[9200] flex max-h-[100dvh] flex-col gap-0 overflow-hidden p-0',
          'max-sm:min-h-[100dvh] max-sm:rounded-none max-sm:pt-10 sm:max-w-lg',
          className,
        )}
      >
        <DialogHeader
          className={cn(
            'shrink-0 px-4 py-3 sm:px-6',
            !hideHeaderSeparator && 'border-b',
            hideTitleOnMobile && !description && 'max-sm:py-2',
            headerClassName,
          )}
        >
          <DialogTitle
            className={cn(
              'pr-12 text-left text-base sm:text-lg',
              hideTitleOnMobile && 'max-sm:sr-only',
              titleClassName,
            )}
          >
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription
              className={cn(
                'text-left text-sm text-muted-foreground',
                descriptionClassName,
              )}
            >
              {description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6',
            contentClassName,
          )}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={cn(
              'shrink-0 px-4 py-3 sm:px-6',
              !hideFooterSeparator && 'border-t',
              footerClassName,
            )}
          >
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export default FsModal
