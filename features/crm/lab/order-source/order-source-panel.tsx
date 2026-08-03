'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Code2, FileCode, RefreshCw } from 'lucide-react'
import { SourceEditor } from '@/features/crm/lab/order-source/source-editor'
import { SourceCommitBar } from '@/features/crm/lab/order-source/source-commit-bar'
import {
  SourceCommitsList,
  type SourceCommitRow,
} from '@/features/crm/lab/order-source/source-commits-list'
type SourcePanelRole = 'admin' | 'integrator' | 'buyer'
type TreeEntry = { path: string; type: 'file' | 'dir'; size?: number }

export function OrderSourcePanel({
  orderId,
  role,
}: {
  orderId: string
  role: SourcePanelRole
}) {
  const t = useTranslations('calculator')
  const readOnly = role === 'buyer'
  const [tree, setTree] = useState<TreeEntry[]>([])
  const [commits, setCommits] = useState<SourceCommitRow[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [baseline, setBaseline] = useState('')
  const [sha, setSha] = useState<string | undefined>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scaffoldFirst, setScaffoldFirst] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  const dirty = content !== baseline

  const loadTreeAndCommits = useCallback(async () => {
    setError(null)
    setScaffoldFirst(false)
    const [treeRes, commitsRes] = await Promise.all([
      fetch(`/api/my-jobs/${orderId}/source/tree`),
      fetch(`/api/my-jobs/${orderId}/source/commits?limit=30`),
    ])
    const treeJson = await treeRes.json()
    const commitsJson = await commitsRes.json()

    if (
      treeRes.status === 409 &&
      (treeJson.code === 'SOURCE_NOT_SCAFFOLDED' || commitsJson.code === 'SOURCE_NOT_SCAFFOLDED')
    ) {
      setScaffoldFirst(true)
      setTree([])
      setCommits([])
      return
    }
    if (!treeRes.ok) throw new Error(treeJson.error || 'Failed to load tree')
    if (!commitsRes.ok && commitsRes.status !== 409) {
      throw new Error(commitsJson.error || 'Failed to load commits')
    }
    const files = ((treeJson.tree || []) as TreeEntry[]).filter((e) => e.type === 'file')
    setTree(files)
    setCommits((commitsJson.commits || []) as SourceCommitRow[])
    setSelectedPath((prev) => prev ?? files[0]?.path ?? null)
  }, [orderId])

  const loadFile = useCallback(
    async (path: string) => {
      setError(null)
      const res = await fetch(
        `/api/my-jobs/${orderId}/source/file?path=${encodeURIComponent(path)}`,
      )
      const json = await res.json()
      if (res.status === 409 && json.code === 'SOURCE_NOT_SCAFFOLDED') {
        setScaffoldFirst(true)
        return
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load file')
      setContent(json.file.content)
      setBaseline(json.file.content)
      setSha(json.file.sha)
      setMessage('')
    },
    [orderId],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await loadTreeAndCommits()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadTreeAndCommits])

  useEffect(() => {
    if (!selectedPath || scaffoldFirst) return
    let cancelled = false
    startTransition(async () => {
      try {
        await loadFile(selectedPath)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedPath, scaffoldFirst, loadFile])

  const commit = () => {
    if (!selectedPath || readOnly || !dirty || !message.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/my-jobs/${orderId}/source/file`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: selectedPath,
            content,
            message: message.trim(),
            sha,
          }),
        })
        const json = await res.json()
        if (res.status === 409 && json.code === 'SOURCE_CONFLICT') {
          setError(t('order.source.conflictReload'))
          await loadFile(selectedPath)
          return
        }
        if (!res.ok) throw new Error(json.error || 'Commit failed')
        setSha(json.contentSha || sha)
        setBaseline(content)
        setMessage('')
        await loadTreeAndCommits()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Commit failed')
      }
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-amber-600" />
          <CardTitle className="text-base">{t('order.source.title')}</CardTitle>
          {readOnly ? (
            <Badge variant="outline">{t('order.source.readOnlyBadge')}</Badge>
          ) : null}
        </div>
        <Button
          disabled={loading || pending}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => {
            startTransition(async () => {
              try {
                await loadTreeAndCommits()
                if (selectedPath) await loadFile(selectedPath)
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Refresh failed')
              }
            })
          }}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${pending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {scaffoldFirst ? (
          <p className="text-sm text-muted-foreground">
            {readOnly
              ? t('order.source.scaffoldFirstBuyer')
              : t('order.source.scaffoldFirst')}
          </p>
        ) : null}

        {!loading && !scaffoldFirst ? (
          <Tabs defaultValue="editor">
            <TabsList>
              <TabsTrigger value="editor">{t('order.source.tree')}</TabsTrigger>
              <TabsTrigger value="commits">{t('order.source.commits')}</TabsTrigger>
            </TabsList>
            <TabsContent className="mt-3 space-y-3" value="editor">
              <div className="grid gap-3 md:grid-cols-[200px_1fr]">
                <ul className="max-h-[360px] space-y-1 overflow-auto rounded-md border p-2 text-sm">
                  {tree.length === 0 ? (
                    <li className="text-muted-foreground">{t('order.source.emptyTree')}</li>
                  ) : (
                    tree.map((f) => (
                      <li key={f.path}>
                        <button
                          className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left font-mono text-xs hover:bg-muted ${
                            selectedPath === f.path ? 'bg-muted font-medium' : ''
                          }`}
                          type="button"
                          onClick={() => setSelectedPath(f.path)}
                        >
                          <FileCode className="h-3 w-3 shrink-0" />
                          <span className="truncate">{f.path}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="flex min-h-[320px] flex-col gap-2">
                  {selectedPath ? (
                    <>
                      <p className="font-mono text-xs text-muted-foreground">{selectedPath}</p>
                      <div className="min-h-0 flex-1">
                        <SourceEditor
                          path={selectedPath}
                          readOnly={readOnly}
                          value={content}
                          onChange={setContent}
                          onSave={commit}
                        />
                      </div>
                      <SourceCommitBar
                        orderId={orderId}
                        path={selectedPath}
                        oldContent={baseline}
                        newContent={content}
                        dirty={dirty}
                        disabled={readOnly}
                        message={message}
                        pending={pending}
                        onCommit={commit}
                        onMessageChange={setMessage}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('order.source.emptyTree')}</p>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent className="mt-3" value="commits">
              <SourceCommitsList commits={commits} orderId={orderId} />
            </TabsContent>
          </Tabs>
        ) : null}
      </CardContent>
    </Card>
  )
}
