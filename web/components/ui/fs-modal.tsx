'use client'

import { useEffect } from 'react'
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

/** Default RingRightRailLayout rail width — used by `layout="centerPane"` desktop inset. */
export const FS_MODAL_CENTER_PANE_RAIL_PX = 300

/** Gap matching `lg:gap-3` between center pane and left nav / right rail. */
export const FS_MODAL_CENTER_PANE_GAP = '0.75rem'

export type FsModalLayout = 'default' | 'centerPane'

export interface FsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Optional header subtitle. Omit when the body carries the description. */
  description?: string
  children: React.ReactNode
  /** Optional bottom bar. Omit to stack actions inside children (no separator). */
  footer?: React.ReactNode
  /** Right-side header actions (e.g. desktop/iPad Close) — sits on the title row. */
  headerActions?: React.ReactNode
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
  /** Merged onto the built-in `.modal-close-button` (e.g. `max-sm:hidden`). */
  closeClassName?: string
  /** Hide built-in top-right close (caller supplies Close in footer). */
  hideCloseButton?: boolean
  /**
   * Radix Dialog open autofocus. Return / preventDefault to skip focusing
   * the first tabbable (e.g. gallery search — avoids mobile keyboard on open).
   */
  onOpenAutoFocus?: (event: Event) => void
  /**
   * Ignore the opening tap leaking through to the overlay (iOS/Android ghost click).
   */
  onPointerDownOutside?: (event: Event) => void
  /** Same window as pointer-down-outside — delayed `click` on WebKit/Blink. */
  onInteractOutside?: (event: Event) => void
  /**
   * `centerPane` — flush fill of the main content column:
   * - max-lg: full viewport (covers floating sidebar toggle)
   * - lg+: inset leaving desktop left nav + right rail visible (same gap both sides)
   */
  layout?: FsModalLayout
  /** Override rail width used for desktop center-pane inset (px). */
  centerPaneRailPx?: number
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
  headerActions,
  className,
  contentClassName,
  headerClassName,
  footerClassName,
  titleClassName,
  descriptionClassName,
  hideHeaderSeparator = false,
  hideFooterSeparator = false,
  hideTitleOnMobile = false,
  closeClassName,
  hideCloseButton = false,
  onOpenAutoFocus,
  onPointerDownOutside,
  onInteractOutside,
  layout = 'default',
  centerPaneRailPx = FS_MODAL_CENTER_PANE_RAIL_PX,
}: FsModalProps) {
  const isCenterPane = layout === 'centerPane'

  useEffect(() => {
    if (!open || !isCenterPane) return
    document.documentElement.setAttribute('data-fs-modal-center-pane', 'open')
    return () => {
      document.documentElement.removeAttribute('data-fs-modal-center-pane')
    }
  }, [open, isCenterPane])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Literal z-[9200] required for Tailwind JIT (see FS_MODAL_Z).
        overlayClassName="z-[9200]"
        hideCloseButton={hideCloseButton}
        closeClassName={closeClassName}
        onOpenAutoFocus={onOpenAutoFocus}
        onPointerDownOutside={onPointerDownOutside}
        onInteractOutside={onInteractOutside}
        style={
          isCenterPane
            ? ({
                // Desktop inset: leave RingRightRailLayout rail + lg:gap-3 visible.
                ['--fs-modal-rail' as string]: `${centerPaneRailPx}px`,
                ['--fs-modal-gap' as string]: FS_MODAL_CENTER_PANE_GAP,
              } as React.CSSProperties)
            : undefined
        }
        className={cn(
          'z-[9200] flex max-h-[100dvh] flex-col gap-0 overflow-hidden p-0',
          !isCenterPane &&
            'max-sm:min-h-[100dvh] max-sm:rounded-none max-sm:pt-10 sm:max-w-lg',
          isCenterPane &&
            cn(
              // Kill Dialog default centering for all breakpoints.
              '!left-0 !top-0 !translate-x-0 !translate-y-0 !rounded-none !pt-0',
              '!max-h-none !h-[100dvh] !w-full !max-w-none',
              // Mobile → iPad: full viewport (above floating sidebar toggle z-50).
              'max-lg:!inset-0',
              // Desktop: match center pane — leave left nav + right rail (same gap).
              // --sidebar-total-w is live (rail 64px + optional aside); portaled Dialog
              // is viewport-relative, so left must include the nav chrome.
              'lg:!inset-y-3',
              'lg:!left-[calc(var(--sidebar-total-w,4rem)+var(--fs-modal-gap,0.75rem))]',
              'lg:!right-[calc(var(--fs-modal-rail,300px)+var(--fs-modal-gap,0.75rem))]',
              'lg:!h-auto lg:!w-auto lg:!rounded-xl',
            ),
          className,
        )}
      >
        <DialogHeader
          className={cn(
            'shrink-0 px-4 py-3 sm:px-6',
            !hideHeaderSeparator && 'border-b',
            hideTitleOnMobile && !description && 'max-sm:py-2',
            isCenterPane && 'max-lg:px-4 lg:px-4',
            headerClassName,
          )}
        >
          <div
            className={cn(
              'flex w-full gap-3',
              headerActions ? 'items-center justify-between' : 'items-start',
            )}
          >
            <div className="min-w-0 flex-1">
              <DialogTitle
                className={cn(
                  'pr-12 text-left text-base sm:text-lg',
                  hideTitleOnMobile && 'max-sm:sr-only',
                  headerActions && 'pr-0',
                  isCenterPane &&
                    'text-xl font-semibold tracking-tight sm:text-2xl',
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
            </div>
            {headerActions ? (
              <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
            ) : null}
          </div>
        </DialogHeader>
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6',
            isCenterPane && 'max-lg:!px-0',
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
