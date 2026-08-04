'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useDropzone } from 'react-dropzone'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { Folder, FileIcon, Plus, Upload, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { UserRolesArray } from '@/features/auth/user-role'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import {
  createFolderAction,
  deleteCabinetNodeAction,
  getCabinetBreadcrumbAction,
  getDesktopAction,
  listCabinetAclAction,
  listCabinetChildrenAction,
  listCabinetFolderTreeAction,
  listOwnCabinetAction,
  listSharedCabinetAction,
  moveCabinetNodeAction,
  saveDesktopAction,
  setCabinetTrusteesAction,
  uploadCabinetFileAction,
  saveGeneratedMediaToDesktopAction,
} from '@/app/_actions/file-cabinet'
import { FILE_CABINET_DESKTOP_CHANNEL, MAX_FOLDER_DEPTH } from '@/features/file-cabinet/constants'
import { cabinetPathDepth } from '@/features/file-cabinet/path'
import {
  iconFromNode,
  visibleIconFilename,
  withVisibleFilename,
} from '@/features/file-cabinet/desktop-filename'
import { cabinetDownloadUrl } from '@/features/file-cabinet/media-urls'
import { FileCabinetDetailPanel } from '@/features/file-cabinet/components/file-cabinet-detail-panel'
import { FileCabinetOptionsPanel } from '@/features/file-cabinet/components/file-cabinet-options-panel'
import { FileCabinetShareFsModal } from '@/features/file-cabinet/components/file-cabinet-share-fs-modal'
import { FileCabinetTree } from '@/features/file-cabinet/components/file-cabinet-tree'
import { FileCabinetImageViewer } from '@/features/file-cabinet/components/file-cabinet-image-viewer'
import { GenerativeMediaEditorFsModal } from '@/features/generative-media/components/generative-media-editor-fs-modal'
import {
  CABINET_ENHANCE_PROMPT,
  CABINET_ENLIVE_PROMPT,
} from '@/features/generative-media/types'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import type {
  FileCabinetDesktopIcon,
  FileCabinetDesktopScope,
  FileCabinetNode,
} from '@/features/file-cabinet/types'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { Link, toAppHref } from '@/i18n/routing'

type Props = {
  scope: FileCabinetDesktopScope
  className?: string
}

export function FileCabinetDesktop({ scope, className }: Props) {
  const { data: session } = useSession()
  const locale = useLocale() as Locale
  const t = useTranslations('modules.fileCabinet')
  const [nodes, setNodes] = useState<FileCabinetNode[]>([])
  const [allFolders, setAllFolders] = useState<FileCabinetNode[]>([])
  const [treeFolders, setTreeFolders] = useState<FileCabinetNode[]>([])
  const [treeExpandedIds, setTreeExpandedIds] = useState<string[]>([])
  const treeExpandedRef = useRef<string[]>([])
  const [breadcrumb, setBreadcrumb] = useState<FileCabinetNode[]>([])
  const [parentId, setParentId] = useState<string | null>(null)
  const [icons, setIcons] = useState<FileCabinetDesktopIcon[]>([])
  const iconsRef = useRef<FileCabinetDesktopIcon[]>([])
  const [folderName, setFolderName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [trusteeIds, setTrusteeIds] = useState<string[]>([])
  const [trusteesRevision, setTrusteesRevision] = useState(0)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [viewerNode, setViewerNode] = useState<FileCabinetNode | null>(null)
  const [genOpen, setGenOpen] = useState(false)
  const [genMode, setGenMode] = useState<'image' | 'video'>('image')
  const [genPrompt, setGenPrompt] = useState('')
  const [genFieldId, setGenFieldId] = useState<'enhance' | 'enlive'>('enhance')
  const [genEntityId, setGenEntityId] = useState<string | undefined>()
  const [genReferenceUrl, setGenReferenceUrl] = useState<string | undefined>()
  const [genSourceNode, setGenSourceNode] = useState<FileCabinetNode | null>(null)
  /** Per-folder icon layouts — changing folders must not reset positions. */
  const folderLayoutsRef = useRef<Map<string, FileCabinetDesktopIcon[]>>(new Map())
  const dragRef = useRef<{
    id: string
    offsetX: number
    offsetY: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)

  const role = session?.user?.role
  const isSubscriberOnly = role === UserRolesArray.subscriber
  const canMutate = scope === 'own'

  const openImageViewer = useCallback((node: FileCabinetNode) => {
    if (!node.mime?.startsWith('image/')) return
    setViewerNode(node)
  }, [])

  const openEnhanceFromNode = useCallback((node: FileCabinetNode) => {
    setViewerNode(null)
    setGenSourceNode(node)
    setGenEntityId(node.id)
    setGenFieldId('enhance')
    setGenMode('image')
    setGenPrompt(CABINET_ENHANCE_PROMPT)
    setGenReferenceUrl(cabinetDownloadUrl(node.id, { inline: true, variant: 'original_webp' }))
    setGenOpen(true)
  }, [])

  const openEnliveFromNode = useCallback((node: FileCabinetNode) => {
    setViewerNode(null)
    setGenSourceNode(node)
    setGenEntityId(node.id)
    setGenFieldId('enlive')
    setGenMode('video')
    setGenPrompt(CABINET_ENLIVE_PROMPT)
    setGenReferenceUrl(cabinetDownloadUrl(node.id, { inline: true, variant: 'original_webp' }))
    setGenOpen(true)
  }, [])

  const viewerNodeRef = useRef<FileCabinetNode | null>(null)
  viewerNodeRef.current = viewerNode

  const handleViewerEnhance = useCallback(() => {
    const node = viewerNodeRef.current
    if (node) openEnhanceFromNode(node)
  }, [openEnhanceFromNode])

  const handleViewerEnlive = useCallback(() => {
    const node = viewerNodeRef.current
    if (node) openEnliveFromNode(node)
  }, [openEnliveFromNode])

  const layoutKey = (folderId: string | null) => folderId ?? '__root__'

  const mergeIconsForChildren = useCallback(
    (children: FileCabinetNode[], existing: FileCabinetDesktopIcon[]) => {
      const known = new Set(existing.map((i) => i.nodeId).filter(Boolean) as string[])
      const extras = children
        .filter((n) => !known.has(n.id))
        .map((n, i) =>
          iconFromNode(n, {
            x: 24 + ((existing.length + i) % 6) * 104,
            y: 24 + Math.floor((existing.length + i) / 6) * 104,
          }),
        )
      const pruned = existing
        .filter((ic) => !ic.nodeId || children.some((n) => n.id === ic.nodeId))
        .map((ic) => {
          const n = children.find((c) => c.id === ic.nodeId)
          if (!n) return ic
          return withVisibleFilename(ic, visibleIconFilename(ic, n.name))
        })
      if (pruned.length > 0 || extras.length > 0) return [...pruned, ...extras]
      return children.map((n, i) =>
        iconFromNode(n, {
          x: 24 + (i % 6) * 104,
          y: 24 + Math.floor(i / 6) * 104,
        }),
      )
    },
    [],
  )

  const goToFolder = useCallback(
    (nextFolderId: string | null, nextSelectedId?: string | null) => {
      folderLayoutsRef.current.set(layoutKey(parentId), [...iconsRef.current])
      setParentId(nextFolderId)
      if (nextSelectedId === undefined) {
        setSelectedId(nextFolderId)
      } else {
        setSelectedId(nextSelectedId)
      }
    },
    [parentId],
  )

  const setIconsSynced = useCallback(
    (
      next:
        | FileCabinetDesktopIcon[]
        | ((prev: FileCabinetDesktopIcon[]) => FileCabinetDesktopIcon[]),
    ) => {
      setIcons((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        iconsRef.current = resolved
        return resolved
      })
    },
    [],
  )

  const persistIcons = useCallback(
    (next: FileCabinetDesktopIcon[]) => {
      folderLayoutsRef.current.set(layoutKey(parentId), next)
      setIconsSynced(next)
      // Persist root layout to desktop document; nested folders stay in session cache
      if (parentId != null) return
      startTransition(async () => {
        try {
          await saveDesktopAction(scope, next, {
            treeExpandedIds: treeExpandedRef.current,
          })
        } catch (e) {
          setError(e instanceof Error ? e.message : t('saveDesktopError'))
        }
      })
    },
    [parentId, scope, setIconsSynced, t],
  )

  const persistTreeExpanded = useCallback(
    (next: string[]) => {
      treeExpandedRef.current = next
      setTreeExpandedIds(next)
      startTransition(async () => {
        try {
          await saveDesktopAction(scope, iconsRef.current, { treeExpandedIds: next })
        } catch {
          /* non-fatal */
        }
      })
    },
    [scope],
  )

  const toggleTreeExpand = useCallback(
    (folderId: string) => {
      const cur = treeExpandedRef.current
      let next: string[]
      if (cur.includes(folderId)) {
        // Collapse: hide descendants — also drop nested expand state for those folders
        const folderById = new Map(treeFolders.map((f) => [f.id, f]))
        const isDescendant = (id: string): boolean => {
          let walk: string | null | undefined = id
          while (walk) {
            if (walk === folderId) return true
            walk = folderById.get(walk)?.parentId
          }
          return false
        }
        next = cur.filter((id) => id !== folderId && !isDescendant(id))
      } else {
        next = [...cur, folderId]
      }
      persistTreeExpanded(next)
    },
    [persistTreeExpanded, treeFolders],
  )

  const reload = useCallback(() => {
    startTransition(async () => {
      try {
        setError(null)
        const [folderTree, desktop] = await Promise.all([
          listCabinetFolderTreeAction(scope),
          getDesktopAction(scope),
        ])
        setTreeFolders(folderTree)
        const expanded = desktop.treeExpandedIds || []
        treeExpandedRef.current = expanded
        setTreeExpandedIds(expanded)

        if (scope === 'shared') {
          const children =
            parentId == null
              ? await listSharedCabinetAction()
              : await listCabinetChildrenAction(parentId)
          setNodes(children)
          setBreadcrumb(parentId ? await getCabinetBreadcrumbAction(parentId) : [])
          setAllFolders(folderTree)
          if (parentId == null) {
            const existing = desktop.icons.length > 0 ? desktop.icons : []
            const merged = mergeIconsForChildren(children, existing)
            folderLayoutsRef.current.set(layoutKey(null), merged)
            setIconsSynced(merged)
          } else {
            const cached = folderLayoutsRef.current.get(layoutKey(parentId)) || []
            const merged = mergeIconsForChildren(children, cached)
            folderLayoutsRef.current.set(layoutKey(parentId), merged)
            setIconsSynced(merged)
          }
          return
        }

        const [list, crumbs] = await Promise.all([
          listOwnCabinetAction(parentId),
          getCabinetBreadcrumbAction(parentId),
        ])
        setNodes(list)
        setBreadcrumb(crumbs)
        setAllFolders(folderTree)

        if (parentId == null) {
          const existing = desktop.icons.length > 0 ? desktop.icons : []
          const merged = mergeIconsForChildren(list, existing)
          folderLayoutsRef.current.set(layoutKey(null), merged)
          setIconsSynced(merged)
          if (extrasChanged(existing, merged)) {
            try {
              await saveDesktopAction(scope, merged, {
                treeExpandedIds: treeExpandedRef.current,
              })
            } catch {
              /* non-fatal */
            }
          }
        } else {
          const cached = folderLayoutsRef.current.get(layoutKey(parentId)) || []
          const merged = mergeIconsForChildren(list, cached)
          folderLayoutsRef.current.set(layoutKey(parentId), merged)
          setIconsSynced(merged)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'))
      }
    })
  }, [mergeIconsForChildren, parentId, scope, setIconsSynced, t])

  const handleSaveGeneratedToDesktop = useCallback(
    async (item: { originalUrl: string; contentType: string; fileId?: string; source: string }) => {
      try {
        const sourceName = genSourceNode?.name || (item.source === 'video' ? 'video' : 'image')
        const baseName = sourceName.replace(/\.[^.]+$/, '').slice(0, 120) || 'generated'
        const ext =
          item.source === 'video'
            ? 'mp4'
            : item.contentType.includes('webp')
              ? 'webp'
              : item.contentType.includes('jpeg') || item.contentType.includes('jpg')
                ? 'jpg'
                : 'png'
        const suffix = item.source === 'video' ? 'enlive' : 'enhanced'
        await saveGeneratedMediaToDesktopAction({
          url: item.originalUrl,
          name: `${baseName}-${suffix}-${Date.now()}.${ext}`,
          mime: item.contentType,
          fileId: item.fileId,
          parentId: genSourceNode?.parentId ?? null,
          addDesktopIcon: genSourceNode?.parentId == null,
        })
        reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('saveDesktopError'))
      }
    },
    [genSourceNode, reload, t],
  )

  function extrasChanged(existing: FileCabinetDesktopIcon[], merged: FileCabinetDesktopIcon[]) {
    if (existing.length !== merged.length) return true
    const a = new Set(existing.map((i) => i.nodeId).filter(Boolean))
    return merged.some((i) => i.nodeId && !a.has(i.nodeId))
  }

  useEffect(() => {
    reload()
  }, [reload])

  useTunnelChannel<{
    scope: string
    icons: FileCabinetDesktopIcon[]
    treeExpandedIds?: string[]
    updatedAt: string
  }>({
    channel: FILE_CABINET_DESKTOP_CHANNEL,
    enabled: Boolean(session?.user?.id) && parentId == null,
    onMessage: (payload) => {
      if (payload?.scope === scope && Array.isArray(payload.icons)) {
        setIconsSynced(payload.icons)
        if (Array.isArray(payload.treeExpandedIds)) {
          treeExpandedRef.current = payload.treeExpandedIds
          setTreeExpandedIds(payload.treeExpandedIds)
        }
      }
    },
  })

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (!canMutate) return
      startTransition(async () => {
        try {
          for (const f of accepted) {
            const fd = new FormData()
            fd.append('file', f)
            if (parentId) fd.append('parentId', parentId)
            const result = await uploadCabinetFileAction(fd)
            if (!result.ok) throw new Error(result.error)
          }
          reload()
        } catch (e) {
          setError(e instanceof Error ? e.message : t('uploadError'))
        }
      })
    },
    [canMutate, parentId, reload, t],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    disabled: !canMutate,
  })

  const onPointerDown = (e: React.PointerEvent, icon: FileCabinetDesktopIcon) => {
    const target = e.currentTarget as HTMLElement
    const rect = target.parentElement?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = {
      id: icon.id,
      offsetX: e.clientX - rect.left - icon.x,
      offsetY: e.clientY - rect.top - icon.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
    target.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { id, offsetX, offsetY, startX, startY } = dragRef.current
    if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 4) {
      dragRef.current.moved = true
    }
    if (!dragRef.current.moved) return
    const x = Math.max(0, e.clientX - rect.left - offsetX)
    const y = Math.max(0, e.clientY - rect.top - offsetY)
    setIconsSynced((prev) => prev.map((ic) => (ic.id === id ? { ...ic, x, y } : ic)))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { id, moved } = dragRef.current
    dragRef.current = null
    if (moved) {
      // Drop onto folder icon → move (own cabinet only)
      if (canMutate) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const dropX = e.clientX - rect.left
        const dropY = e.clientY - rect.top
        const target = iconsRef.current.find(
          (ic) =>
            ic.id !== id &&
            ic.kind === 'dir' &&
            dropX >= ic.x &&
            dropX <= ic.x + 96 &&
            dropY >= ic.y &&
            dropY <= ic.y + 96,
        )
        const dragged = iconsRef.current.find((ic) => ic.id === id)
        if (target?.nodeId && dragged?.nodeId) {
          startTransition(async () => {
            try {
              await moveCabinetNodeAction(dragged.nodeId!, target.nodeId!)
              reload()
            } catch (errMove) {
              setError(errMove instanceof Error ? errMove.message : t('moveError'))
              persistIcons(iconsRef.current)
            }
          })
          return
        }
      }
      persistIcons(iconsRef.current)
    } else {
      const clicked = iconsRef.current.find((ic) => ic.id === id)
      setSelectedId(clicked?.nodeId || id)
    }
  }

  const currentDepth = parentId
    ? cabinetPathDepth(breadcrumb[breadcrumb.length - 1]?.path || '')
    : 0
  const canCreateFolder = canMutate && currentDepth < MAX_FOLDER_DEPTH

  const addFolder = () => {
    if (!folderName.trim() || !canCreateFolder) return
    startTransition(async () => {
      try {
        await createFolderAction(folderName.trim(), parentId)
        setFolderName('')
        reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('createFolderError'))
      }
    })
  }

  /** Empty folders only — non-empty cannot be deleted from this control. */
  const deleteEmptyFolder = () => {
    if (!canMutate || !parentId || icons.length > 0 || nodes.length > 0) return
    const folderNameLabel =
      breadcrumb[breadcrumb.length - 1]?.name || t('breadcrumbRoot')
    if (!window.confirm(t('deleteEmptyFolderConfirm', { name: folderNameLabel }))) return
    const folderId = parentId
    const parentOfFolder =
      breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2]?.id ?? null : null
    startTransition(async () => {
      try {
        await deleteCabinetNodeAction(folderId)
        goToFolder(parentOfFolder, null)
        reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('deleteError'))
      }
    })
  }

  const openShare = useCallback(
    (nodeId: string) => {
      setSelectedId(nodeId)
      setShareOpen(true)
      startTransition(async () => {
        try {
          const acl = await listCabinetAclAction(nodeId)
          setTrusteeIds(acl.filter((e) => e.role === 'trustee').map((e) => e.userId))
        } catch (e) {
          setTrusteeIds([])
          setError(e instanceof Error ? e.message : t('trusteesLoadError'))
        }
      })
    },
    [t],
  )

  const saveTrustees = useCallback(() => {
    if (!selectedId) return
    startTransition(async () => {
      try {
        await setCabinetTrusteesAction(selectedId, trusteeIds)
        setShareOpen(false)
        setTrusteesRevision((n) => n + 1)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('trusteesSaveError'))
      }
    })
  }, [selectedId, t, trusteeIds])

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const selectedNode = selectedId ? byId.get(selectedId) : undefined
  const selectedIcon = useMemo(
    () =>
      icons.find((ic) => ic.nodeId === selectedId || ic.id === selectedId) ||
      null,
    [icons, selectedId],
  )
  const selectedDisplayName = selectedIcon
    ? visibleIconFilename(selectedIcon, selectedNode?.name || '')
    : selectedNode?.name || ''

  const title =
    scope === 'shared' ? t('sharedTitle') : t('title')

  const rail = (
    <div className="relative -ml-3 flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col gap-2 overflow-visible p-3 pl-6 pr-2">
      <div className="shrink-0 space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      {scope === 'shared' && isSubscriberOnly ? (
        <div className="shrink-0 space-y-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <p>{t('membersUpgrade')}</p>
          <Button asChild size="sm" className="w-full">
            <Link
              href={toAppHref(
                `${ROUTES.MEMBERSHIP(locale)}?returnTo=${encodeURIComponent('/profile/shared')}`,
              )}
            >
              {t('upgrade')}
            </Link>
          </Button>
        </div>
      ) : null}

      {error ? <p className="shrink-0 text-xs text-destructive">{error}</p> : null}

      <FileCabinetTree
        folders={treeFolders}
        icons={icons}
        selectedId={selectedId}
        workspaceFolderId={parentId}
        expandedIds={treeExpandedIds}
        onToggleExpand={toggleTreeExpand}
        onSelect={(id) => setSelectedId(id)}
        onOpenFolder={(id) => {
          goToFolder(id, id)
          setRightSidebarOpen(false)
        }}
      />

      {selectedNode ? (
        <FileCabinetOptionsPanel
          node={selectedNode}
          displayName={selectedDisplayName}
          canMutate={canMutate}
          folders={allFolders}
          trusteesRevision={trusteesRevision}
          onOpenFolder={(id) => {
            goToFolder(id, id)
          }}
          onOpenImage={openImageViewer}
          onChanged={reload}
          onShare={() => selectedId && openShare(selectedId)}
          onRenamed={(name) => {
            if (!selectedId) return
            setIconsSynced((prev) =>
              prev.map((ic) =>
                ic.nodeId === selectedId || ic.id === selectedId
                  ? withVisibleFilename(ic, name)
                  : ic,
              ),
            )
          }}
        />
      ) : null}

      <FileCabinetDetailPanel
        node={selectedNode || null}
        displayName={selectedDisplayName}
        className="border-t border-border/40"
        onOpenImage={openImageViewer}
        canGenerate={canMutate}
        onGenerateImage={openEnhanceFromNode}
        onGenerateVideo={openEnliveFromNode}
      />
    </div>
  )

  return (
    <RingRightRailLayout
      showRightRail
      flushCenterPane
      railWidth={320}
      rightRailPurpose="file-cabinet"
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
      rightRail={rail}
      railClassName="overflow-visible"
      className={className}
    >
      <DavinciCenterPane
        className="min-h-[calc(100dvh-4rem)] rounded-none border-0 bg-transparent shadow-none"
        contentClassName="flex min-h-0 flex-1 flex-col !p-0 sm:!p-0 lg:!p-0"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2">
            <nav
              className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm"
              aria-label="Breadcrumb"
            >
              <Button
                type="button"
                size="sm"
                variant={parentId == null ? 'secondary' : 'ghost'}
                onClick={() => goToFolder(null, null)}
              >
                {t('breadcrumbRoot')}
              </Button>
              {breadcrumb.map((crumb) => (
                <span key={crumb.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <Button
                    type="button"
                    size="sm"
                    variant={parentId === crumb.id ? 'secondary' : 'ghost'}
                    onClick={() => goToFolder(crumb.id, null)}
                  >
                    {crumb.name}
                  </Button>
                </span>
              ))}
            </nav>

            {canMutate ? (
              <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <Input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder={t('newFolder')}
                  className="h-8 w-36 sm:w-44"
                  disabled={!canCreateFolder}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addFolder()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={addFolder}
                  disabled={pending || !folderName.trim() || !canCreateFolder}
                  title={!canCreateFolder ? t('depthLimit') : undefined}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {t('folder')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => open()}
                  disabled={pending}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  {t('upload')}
                </Button>
              </div>
            ) : null}
          </div>

          <div
            {...getRootProps()}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={cn(
              'relative min-h-0 flex-1 overflow-hidden',
              isDragActive && 'ring-2 ring-inset ring-primary',
            )}
          >
            <input {...getInputProps()} />
            {icons.map((icon) => {
              const node = icon.nodeId ? byId.get(icon.nodeId) : undefined
              const KindIcon = icon.kind === 'dir' ? Folder : FileIcon
              const label = visibleIconFilename(icon, node?.name || icon.label)
              const isSelected =
                selectedId != null &&
                (selectedId === icon.nodeId || selectedId === icon.id)
              const isImage = Boolean(node?.mime?.startsWith('image/') && node.id)
              return (
                <button
                  key={icon.id}
                  type="button"
                  className={cn(
                    'absolute flex w-24 cursor-grab flex-col items-center gap-1 rounded-md p-2 text-center active:cursor-grabbing hover:bg-foreground/5',
                    isSelected && 'bg-foreground/10 ring-2 ring-primary',
                  )}
                  style={{ left: icon.x, top: icon.y }}
                  onPointerDown={(e) => onPointerDown(e, icon)}
                  onDoubleClick={() => {
                    if (icon.kind === 'dir' && icon.nodeId) {
                      goToFolder(icon.nodeId, null)
                    } else if (node?.mime?.startsWith('image/')) {
                      openImageViewer(node)
                    }
                  }}
                  title={label}
                >
                  {isImage && node ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cabinetDownloadUrl(node.id, {
                        inline: true,
                        variant: 'sync_thumb',
                      })}
                      alt=""
                      draggable={false}
                      className="h-10 w-10 rounded-sm object-cover shadow-sm ring-1 ring-border/60"
                    />
                  ) : (
                    <KindIcon className="h-10 w-10 text-primary" />
                  )}
                  <span className="line-clamp-2 text-xs leading-tight">{label}</span>
                  {node?.mime ? <span className="sr-only">{node.mime}</span> : null}
                </button>
              )
            })}
            {icons.length === 0 && !pending ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {scope === 'shared'
                    ? t('emptyShared')
                    : parentId
                      ? t('emptyFolder')
                      : t('emptyOwn')}
                </p>
                {canMutate && parentId && nodes.length === 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={deleteEmptyFolder}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {t('delete')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <ul className="space-y-1 border-t border-border/40 p-3 md:hidden">
            {nodes.map((n) => {
              const icon = icons.find((i) => i.nodeId === n.id)
              const label = icon ? visibleIconFilename(icon, n.name) : n.name
              return (
                <li
                  key={n.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                    selectedId === n.id && 'ring-2 ring-primary',
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => setSelectedId(n.id)}
                    onDoubleClick={() => {
                      if (n.kind === 'dir') {
                        goToFolder(n.id, null)
                      } else if (n.mime?.startsWith('image/')) {
                        openImageViewer(n)
                      }
                    }}
                  >
                    {n.kind === 'dir' ? (
                      <Folder className="h-4 w-4 shrink-0" />
                    ) : n.mime?.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cabinetDownloadUrl(n.id, {
                          inline: true,
                          variant: 'sync_thumb',
                        })}
                        alt=""
                        className="h-4 w-4 shrink-0 rounded-sm object-cover"
                      />
                    ) : (
                      <FileIcon className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <FileCabinetShareFsModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          locale={locale}
          name={selectedDisplayName}
          trusteeIds={trusteeIds}
          onTrusteeIdsChange={setTrusteeIds}
          onSave={() => saveTrustees()}
          pending={pending}
        />

        <FileCabinetImageViewer
          open={Boolean(viewerNode)}
          onClose={() => setViewerNode(null)}
          nodeId={viewerNode?.id}
          title={viewerNode?.name}
          alt={viewerNode?.name}
          allowGenerate={canMutate}
          onEnhance={handleViewerEnhance}
          onEnlive={handleViewerEnlive}
        />

        <GenerativeMediaEditorFsModal
          open={genOpen}
          onOpenChange={setGenOpen}
          scope="cabinet"
          pageSlug="file-cabinet"
          fieldId={genFieldId}
          entityId={genEntityId}
          purpose={`cabinet-${genFieldId}`}
          actionUrl="/file-cabinet"
          context={
            genSourceNode?.path.split('/').includes('alt')
              ? {
                  name: genSourceNode.path.split('/').at(-3),
                  category: 'Product research alternative',
                  vendorName: genSourceNode.path.split('/').at(-4),
                  description: `Create a product-ready sibling of ${genSourceNode.name}.`,
                }
              : { name: genSourceNode?.name }
          }
          initialMode={genMode}
          initialPrompt={genPrompt}
          referenceImageUrl={genReferenceUrl}
          onSaveToDesktop={handleSaveGeneratedToDesktop}
        />
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
