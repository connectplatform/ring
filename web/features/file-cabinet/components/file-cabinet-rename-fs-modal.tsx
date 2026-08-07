'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FsModal } from '@/components/ui/fs-modal'
import { renameCabinetNodeAction } from '@/app/_actions/file-cabinet'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeId: string
  currentName: string
  kind: 'file' | 'dir'
  onRenamed?: (name: string) => void
}

/**
 * Rename fs-modal — existing name selected + focused (mobile keyboard activates).
 * Overwrites display name; no rename history.
 */
export function FileCabinetRenameFsModal({
  open,
  onOpenChange,
  nodeId,
  currentName,
  kind,
  onRenamed,
}: Props) {
  const t = useTranslations('modules.fileCabinet')
  const [value, setValue] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setValue(currentName)
    setError(null)
    const id = window.setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.select()
    }, 50)
    return () => window.clearTimeout(id)
  }, [open, currentName])

  const submit = () => {
    const next = value.trim()
    if (!next || next === currentName) {
      onOpenChange(false)
      return
    }
    startTransition(async () => {
      try {
        await renameCabinetNodeAction(nodeId, next)
        onRenamed?.(next)
        onOpenChange(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('renameError'))
      }
    })
  }

  return (
    <FsModal
      open={open}
      onOpenChange={onOpenChange}
      title={kind === 'dir' ? t('renameFolderTitle') : t('renameFileTitle')}
      description={t('renameHint')}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button type="button" disabled={pending || !value.trim()} onClick={submit}>
            {t('rename')}
          </Button>
        </div>
      }
    >
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        autoComplete="off"
        enterKeyHint="done"
        aria-label={t('rename')}
      />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </FsModal>
  )
}
