'use client'

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  wikiBacklinksAction,
  wikiCreateAction,
  wikiCreateMissingStubsAction,
  wikiDeleteAction,
  wikiLintAction,
  wikiListAction,
  wikiSearchAction,
  wikiUpdateAction,
} from '@/app/_actions/wiki'
import type { VaultKey, WikiLink, WikiLintIssue, WikiPage } from '@/features/wiki/types'
import { findPageByWikiTarget } from '@/features/wiki/resolve-page-target'
import { WikiMarkdownPreview } from '@/features/wiki/wiki-markdown'
import { WikiRichEditor } from '@/features/wiki/components/wiki-rich-editor'
import { WikiPageTree } from '@/features/wiki/components/wiki-page-tree'
import { Loader2, Plus, RefreshCw, Search, Trash2, Wand2 } from 'lucide-react'

type Props = {
  locale: string
  initialVaultKey?: VaultKey
  lockedOrderId?: string
  appendOnly?: boolean
}

export function WikiWorkspace({
  initialVaultKey = 'tenant',
  lockedOrderId,
  appendOnly = false,
}: Props) {
  const lockedVault: VaultKey | null = lockedOrderId
    ? (`po:${lockedOrderId}` as VaultKey)
    : null
  const [vaultKey, setVaultKey] = useState<VaultKey>(lockedVault || initialVaultKey)
  const [pages, setPages] = useState<WikiPage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [path, setPath] = useState('')
  const [body, setBody] = useState('')
  const [appendDraft, setAppendDraft] = useState('')
  const [query, setQuery] = useState('')
  const [treeFilter, setTreeFilter] = useState('')
  const [searchHits, setSearchHits] = useState<
    Array<{ pageId: string; concept: string; snippet: string; score: number }>
  >([])
  const [backlinks, setBacklinks] = useState<WikiLink[]>([])
  const [lint, setLint] = useState<WikiLintIssue[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [projectOrderInput, setProjectOrderInput] = useState('')
  const pendingSelectTarget = useRef<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedId

  const selected = useMemo(
    () => pages.find((p) => p.id === selectedId) || null,
    [pages, selectedId],
  )

  const missingCount = useMemo(
    () => lint.filter((i) => i.code === 'missing_page').length,
    [lint],
  )

  /**
   * React 19 useEffectEvent: vault load is an "effect event" — always sees
   * latest selectedId/pendingSelect without putting them in effect deps
   * (avoids re-fetch loops + eslint-disable on exhaustive-deps).
   */
  const loadVault = useEffectEvent((vk: VaultKey) => {
    startTransition(async () => {
      setError(null)
      try {
        // Server Action: list + ensureTenantSchema (repair/resync when needed)
        const list = await wikiListAction(vk)
        setPages(list)
        const pendingTarget = pendingSelectTarget.current
        if (pendingTarget) {
          const hit = findPageByWikiTarget(list, pendingTarget)
          pendingSelectTarget.current = null
          if (hit) {
            setSelectedId(hit.id)
            return
          }
        }
        const currentSelected = selectedIdRef.current
        if (currentSelected && !list.some((p) => p.id === currentSelected)) {
          setSelectedId(list[0]?.id ?? null)
        } else if (!currentSelected && list.length) {
          setSelectedId(list[0].id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  })

  useEffect(() => {
    loadVault(vaultKey)
  }, [vaultKey])

  const hydrateSelection = useEffectEvent((id: string | null) => {
    if (!id) {
      setTitle('')
      setPath('')
      setBody('')
      setBacklinks([])
      setAppendDraft('')
      return
    }
    // Always read latest `pages` via useEffectEvent (no stale closure / no pages in deps)
    const page = pages.find((p) => p.id === id)
    if (!page) return
    setTitle(page.title)
    setPath(page.path || '')
    setBody(page.bodyMarkdown || '')
    setAppendDraft('')
    startTransition(async () => {
      try {
        setBacklinks(await wikiBacklinksAction(id))
      } catch {
        setBacklinks([])
      }
    })
  })

  useEffect(() => {
    hydrateSelection(selectedId)
  }, [selectedId])

  const reload = useCallback(() => {
    loadVault(vaultKey)
  }, [vaultKey])

  const onCreate = () => {
    startTransition(async () => {
      setError(null)
      try {
        const page = await wikiCreateAction({
          title: 'Untitled',
          vaultKey,
          bodyMarkdown: '# Untitled\n\n',
          kind: 'page',
        })
        setPages((prev) => [page, ...prev])
        setSelectedId(page.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const onSave = () => {
    if (!selected) return
    startTransition(async () => {
      setError(null)
      try {
        if (appendOnly) {
          const updated = await wikiUpdateAction(selected.id, {
            bodyMarkdown: appendDraft,
            mode: 'append',
          })
          setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          setBody(updated.bodyMarkdown)
          setAppendDraft('')
        } else {
          const updated = await wikiUpdateAction(selected.id, {
            title,
            path,
            bodyMarkdown: body,
            mode: 'replace',
          })
          setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const onDelete = () => {
    if (!selected) return
    startTransition(async () => {
      setError(null)
      try {
        await wikiDeleteAction(selected.id)
        setPages((prev) => prev.filter((p) => p.id !== selected.id))
        setSelectedId(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const onSearch = () => {
    startTransition(async () => {
      try {
        const result = await wikiSearchAction(query, vaultKey)
        setSearchHits(
          result.matches.map((h) => ({
            pageId: h.pageId,
            concept: h.concept,
            snippet: h.snippet,
            score: h.score,
          })),
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const onLint = () => {
    startTransition(async () => {
      try {
        setLint(await wikiLintAction(vaultKey))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const onCreateStubs = () => {
    startTransition(async () => {
      setError(null)
      try {
        const result = await wikiCreateMissingStubsAction(vaultKey)
        const list = await wikiListAction(vaultKey)
        setPages(list)
        setLint(await wikiLintAction(vaultKey))
        if (result.created[0]) setSelectedId(result.created[0].id)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const navigateToLink = (link: { target: string; linkKind: string }) => {
    // Cross-vault: [[@Page]] / tenant:Page from a project vault → switch to tenant
    if (link.linkKind === 'tenant_ref' && vaultKey !== 'tenant' && !lockedVault) {
      pendingSelectTarget.current = link.target
      setVaultKey('tenant')
      return
    }
    const hit = findPageByWikiTarget(pages, link.target)
    if (hit) setSelectedId(hit.id)
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row">
      <aside className="flex w-full flex-col gap-3 border-border lg:w-72 lg:border-r lg:pr-4">
        {!lockedVault ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Vault</label>
            <div className="flex gap-2">
              <Button
                size="sm"
                type="button"
                variant={vaultKey === 'tenant' ? 'default' : 'outline'}
                onClick={() => setVaultKey('tenant')}
              >
                Tenant
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="project order id"
                value={projectOrderInput}
                onChange={(e) => setProjectOrderInput(e.target.value)}
              />
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  const id = projectOrderInput.trim()
                  if (id) setVaultKey(`po:${id}`)
                }}
              >
                Open
              </Button>
            </div>
          </div>
        ) : (
          <Badge variant="secondary">Project {lockedOrderId}</Badge>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Search vault…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setTreeFilter(e.target.value)
            }}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
          <Button size="icon" type="button" variant="outline" onClick={onSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {searchHits.length > 0 ? (
          <div className="space-y-1 text-xs">
            {searchHits.map((h) => (
              <button
                key={h.pageId}
                type="button"
                className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
                onClick={() => setSelectedId(h.pageId)}
              >
                <div className="font-medium">{h.concept}</div>
                <div className="line-clamp-2 text-muted-foreground">{h.snippet}</div>
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Pages</span>
          <div className="flex gap-1">
            <Button size="icon" type="button" variant="ghost" onClick={reload} disabled={pending}>
              <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="icon" type="button" variant="ghost" onClick={onCreate}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <WikiPageTree
          pages={pages}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filterTerm={treeFilter}
        />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" type="button" variant="outline" onClick={onLint}>
            Lint vault
          </Button>
          {missingCount > 0 ? (
            <Button size="sm" type="button" variant="secondary" onClick={onCreateStubs}>
              <Wand2 className="mr-1 h-3.5 w-3.5" />
              Create {missingCount} stubs
            </Button>
          ) : null}
        </div>
        {lint.length > 0 ? (
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-amber-700 dark:text-amber-400">
            {lint.map((i, idx) => (
              <li key={`${i.code}-${idx}`}>
                [{i.code}] {i.message}
              </li>
            ))}
          </ul>
        ) : null}
      </aside>

      <section className="min-w-0 flex-1 space-y-3">
        {error ? (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!selected ? (
          <p className="text-muted-foreground">Select or create a wiki page.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-md font-semibold"
                value={title}
                disabled={appendOnly}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Input
                className="max-w-xs"
                placeholder="path (e.g. concepts)"
                value={path}
                disabled={appendOnly}
                onChange={(e) => setPath(e.target.value)}
              />
              <Badge variant="outline">{selected.kind}</Badge>
              {appendOnly ? <Badge>Append-only</Badge> : null}
              <Button
                type="button"
                onClick={onSave}
                disabled={pending || (appendOnly && !appendDraft.trim())}
              >
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {appendOnly ? 'Append' : 'Save'}
              </Button>
              {!appendOnly ? (
                <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            {appendOnly ? (
              <>
                <div className="min-h-[280px] rounded border border-border p-4">
                  <WikiMarkdownPreview markdown={body} vaultKey={vaultKey} />
                </div>
                <Textarea
                  className="min-h-[140px] font-mono text-sm"
                  value={appendDraft}
                  onChange={(e) => setAppendDraft(e.target.value)}
                  placeholder="Append a new Markdown section…"
                />
              </>
            ) : (
              <WikiRichEditor
                key={selected.id}
                value={body}
                onChange={setBody}
                placeholder="Markdown + [[wikilinks]] / [[@TenantPage]]"
                onNavigateWikiLink={navigateToLink}
              />
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold">Backlinks</h3>
              {backlinks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No backlinks yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {backlinks.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline"
                        onClick={() => setSelectedId(b.fromId)}
                      >
                        {b.fromId.slice(0, 8)}… → {b.toSlug} ({b.linkKind})
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
