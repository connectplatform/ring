'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { FsModal } from '@/components/ui/fs-modal'
import { ContactPicker } from '@/components/contacts'
import { getCabinetTrusteeProfilesAction, type CabinetTrusteeProfile } from '@/app/_actions/file-cabinet'
import { FileCabinetTrusteeStack } from '@/features/file-cabinet/components/file-cabinet-trustee-stack'
import { FileCabinetTrusteeRowSkeleton } from '@/features/file-cabinet/components/file-cabinet-skeletons'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  name: string
  trusteeIds: string[]
  onTrusteeIdsChange: (ids: string[]) => void
  onSave: () => void
  pending?: boolean
}

/**
 * Share / trustees fs-modal — live Trustees row + flush ContactPicker (no glass inset).
 */
export function FileCabinetShareFsModal({
  open,
  onOpenChange,
  locale,
  name,
  trusteeIds,
  onTrusteeIdsChange,
  onSave,
  pending,
}: Props) {
  const t = useTranslations('modules.fileCabinet')
  const [profiles, setProfiles] = useState<CabinetTrusteeProfile[]>([])
  const [loadingProfiles, startLoad] = useTransition()

  useEffect(() => {
    if (!open) return
    if (trusteeIds.length === 0) {
      setProfiles([])
      return
    }
    startLoad(async () => {
      try {
        const list = await getCabinetTrusteeProfilesAction(trusteeIds)
        const byId = new Map(list.map((p) => [p.id, p]))
        setProfiles(
          trusteeIds.map(
            (id) =>
              byId.get(id) || {
                id,
                name: id.slice(0, 8),
                image: null,
              },
          ),
        )
      } catch {
        setProfiles(trusteeIds.map((id) => ({ id, name: id.slice(0, 8), image: null })))
      }
    })
  }, [open, trusteeIds])

  const confirmLabel = pending
    ? t('savingTrustees')
    : trusteeIds.length === 0
      ? t('makeConfidential')
      : t('saveTrustees')

  return (
    <FsModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('shareTrusteesTitle', { name })}
      description={t('shareTrusteesHint')}
      className="sm:max-w-xl"
      contentClassName="flex min-h-0 flex-1 flex-col gap-3 !px-3 !py-3 sm:!px-4"
    >
      <div className="shrink-0">
        {loadingProfiles && trusteeIds.length > 0 ? (
          <FileCabinetTrusteeRowSkeleton />
        ) : trusteeIds.length === 0 ? (
          <div
            className={cn(
              'flex h-11 w-full items-center gap-2 rounded-lg px-2',
              'border border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]',
              'bg-[color-mix(in_oklch,var(--davinci-beam)_6%,transparent)]',
            )}
          >
            <span className="text-xs font-medium text-muted-foreground">{t('trusteeLabel')}</span>
            <span className="ml-auto text-xs font-medium text-foreground">{t('confidential')}</span>
          </div>
        ) : (
          <FileCabinetTrusteeStack
            trustees={profiles}
            label={t('trusteeLabel')}
          />
        )}
      </div>

      <ContactPicker
        locale={locale}
        mode="message"
        selectionMode="multiple"
        className="min-h-0 flex-1"
        onSelect={() => {}}
        selectedUserIds={trusteeIds}
        onSelectedUserIdsChange={onTrusteeIdsChange}
        onConfirmMultiple={() => {
          if (!pending) onSave()
        }}
        confirmLabel={confirmLabel}
        itemLayout="inline"
        hideWalletAddress
        hideSelectionChips
        allowEmptyConfirm
      />
    </FsModal>
  )
}
