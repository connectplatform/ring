'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Download,
  FolderOpen,
  Pencil,
  Trash2,
  FolderInput,
  FileIcon,
  Folder,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DavinciGlassPanel } from '@/lib/ui/davinci'
import { FILE_CABINET_DOWNLOAD_PATH } from '@/features/file-cabinet/constants'
import {
  deleteCabinetNodeAction,
  getCabinetTrusteeProfilesAction,
  listCabinetAclAction,
  moveCabinetNodeAction,
  type CabinetTrusteeProfile,
} from '@/app/_actions/file-cabinet'
import type { FileCabinetNode } from '@/features/file-cabinet/types'
import { FileCabinetTrusteeStack } from '@/features/file-cabinet/components/file-cabinet-trustee-stack'
import { FileCabinetRenameFsModal } from '@/features/file-cabinet/components/file-cabinet-rename-fs-modal'
import { FileCabinetTrusteeRowSkeleton } from '@/features/file-cabinet/components/file-cabinet-skeletons'
import { cn } from '@/lib/utils'

type Props = {
  node: FileCabinetNode | null
  displayName: string
  canMutate: boolean
  folders: FileCabinetNode[]
  /** Bump after share save so Trustees row reloads for the same node id. */
  trusteesRevision?: number
  className?: string
  onOpenFolder?: (id: string) => void
  onOpenImage?: (node: FileCabinetNode) => void
  onChanged?: () => void
  onShare?: () => void
  onRenamed?: (name: string) => void
}

export function FileCabinetOptionsPanel({
  node,
  displayName,
  canMutate,
  folders,
  trusteesRevision = 0,
  className,
  onOpenFolder,
  onOpenImage,
  onChanged,
  onShare,
  onRenamed,
}: Props) {
  const t = useTranslations('modules.fileCabinet')
  const [pending, startTransition] = useTransition()
  const [trusteesLoading, setTrusteesLoading] = useState(false)
  const [moving, setMoving] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [trustees, setTrustees] = useState<CabinetTrusteeProfile[]>([])
  const [trusteesReady, setTrusteesReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTrustees = useCallback((nodeId: string) => {
    setTrusteesLoading(true)
    setTrusteesReady(false)
    startTransition(async () => {
      try {
        const acl = await listCabinetAclAction(nodeId)
        const ids = acl.filter((e) => e.role === 'trustee').map((e) => e.userId).filter(Boolean)
        if (ids.length === 0) {
          setTrustees([])
          return
        }
        try {
          const profiles = await getCabinetTrusteeProfilesAction(ids)
          const byId = new Map(profiles.map((p) => [p.id, p]))
          setTrustees(
            ids.map(
              (id) =>
                byId.get(id) || {
                  id,
                  name: id.slice(0, 8),
                  image: null,
                },
            ),
          )
        } catch {
          setTrustees(ids.map((id) => ({ id, name: id.slice(0, 8), image: null })))
        }
      } catch {
        setTrustees([])
      } finally {
        setTrusteesLoading(false)
        setTrusteesReady(true)
      }
    })
  }, [])

  useEffect(() => {
    setMoving(false)
    setError(null)
    setTrustees([])
    setTrusteesReady(false)
    if (!node) return
    loadTrustees(node.id)
  }, [node?.id, trusteesRevision, loadTrustees])

  if (!node) return null

  const Icon = node.kind === 'dir' ? Folder : FileIcon
  const downloadUrl = `${FILE_CABINET_DOWNLOAD_PATH}?nodeId=${encodeURIComponent(node.id)}`
  const isShared = trustees.length > 0

  return (
    <>
      <DavinciGlassPanel
        title={displayName}
        icon={<Icon className="h-3.5 w-3.5" />}
        className={cn('shrink-0', className)}
        innerClassName="space-y-2 p-3"
        beamDuration="8s"
      >
        {trusteesLoading || !trusteesReady ? (
          <FileCabinetTrusteeRowSkeleton />
        ) : isShared ? (
          <FileCabinetTrusteeStack
            trustees={trustees}
            label={t('trusteeLabel')}
            onClick={canMutate ? onShare : undefined}
          />
        ) : canMutate ? (
          <button
            type="button"
            onClick={onShare}
            className={cn(
              'flex h-11 w-full items-center gap-2 rounded-lg px-2 text-left',
              'border border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]',
              'bg-[color-mix(in_oklch,var(--davinci-beam)_6%,transparent)]',
              'hover:bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]',
            )}
          >
            <span className="text-xs font-medium text-muted-foreground">{t('trusteeLabel')}</span>
            <span className="ml-auto text-xs font-medium text-foreground">{t('confidential')}</span>
          </button>
        ) : null}

        <div className="flex min-h-8 flex-wrap gap-1.5">
          {node.kind === 'dir' ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => onOpenFolder?.(node.id)}
            >
              <FolderOpen className="mr-1 h-3.5 w-3.5" />
              {t('open')}
            </Button>
          ) : node.mime?.startsWith('image/') ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => onOpenImage?.(node)}
              >
                <FolderOpen className="mr-1 h-3.5 w-3.5" />
                {t('open')}
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={downloadUrl} download={displayName}>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  {t('download')}
                </a>
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="secondary" asChild>
              <a href={downloadUrl} download={displayName}>
                <Download className="mr-1 h-3.5 w-3.5" />
                {t('download')}
              </a>
            </Button>
          )}

          {canMutate ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setRenameOpen(true)}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t('rename')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setMoving((v) => !v)}
              >
                <FolderInput className="mr-1 h-3.5 w-3.5" />
                {t('move')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(t('deleteConfirm', { name: displayName }))) return
                  startTransition(async () => {
                    try {
                      await deleteCabinetNodeAction(node.id)
                      onChanged?.()
                    } catch (e) {
                      setError(e instanceof Error ? e.message : t('deleteError'))
                    }
                  })
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {t('delete')}
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">{t('trusteeBadge')}</span>
          )}
        </div>

        {moving && canMutate ? (
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border/50 p-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                startTransition(async () => {
                  try {
                    await moveCabinetNodeAction(node.id, null)
                    setMoving(false)
                    onChanged?.()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : t('moveError'))
                  }
                })
              }}
            >
              {t('breadcrumbRoot')}
            </Button>
            {folders
              .filter((f) => f.id !== node.id)
              .map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await moveCabinetNodeAction(node.id, f.id)
                        setMoving(false)
                        onChanged?.()
                      } catch (e) {
                        setError(e instanceof Error ? e.message : t('moveError'))
                      }
                    })
                  }}
                >
                  {f.name}
                </Button>
              ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setMoving(false)}>
              {t('cancel')}
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </DavinciGlassPanel>

      <FileCabinetRenameFsModal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        nodeId={node.id}
        currentName={displayName}
        kind={node.kind}
        onRenamed={(name) => {
          onRenamed?.(name)
          onChanged?.()
        }}
      />
    </>
  )
}
