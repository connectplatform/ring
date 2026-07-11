/**
 * Ring API Tree — vertical (9:14) docs widget.
 * Upper: scrollable family tree of selectable `/api/*` endpoints.
 * Lower: selected endpoint summary + HTTP methods.
 * Aimed at founders who know what an API is but do not live in route handlers.
 */

'use client'

import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, ChevronRight, Network, Search } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  API_TREE_FAMILIES,
  API_TREE_ROUTE_COUNT,
  findEndpoint,
  type ApiEndpointNode,
  type ApiFamilyNode,
  type ApiHttpMethod,
} from '@/components/ring-widgets/ring-api-tree-data'

export interface RingApiTreeProps {
  /** Optional initial endpoint id (path without `/api/` prefix) */
  initialEndpointId?: string
  className?: string
  /** Compact title override */
  title?: string
}

const METHOD_TONE: Record<ApiHttpMethod, string> = {
  GET: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25',
  POST: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/25',
  PUT: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-amber-500/25',
  PATCH: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 ring-orange-500/25',
  DELETE: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/25',
}

function MethodBadges({ methods }: { methods: ApiHttpMethod[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {methods.map((m) => (
        <span
          key={m}
          className={cn(
            'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ring-1 ring-inset',
            METHOD_TONE[m],
          )}
        >
          {m}
        </span>
      ))}
    </div>
  )
}

function FamilyBranch({
  family,
  open,
  onToggle,
  selectedId,
  onSelect,
  query,
}: {
  family: ApiFamilyNode
  open: boolean
  onToggle: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return family.endpoints
    return family.endpoints.filter(
      (e) =>
        e.path.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q),
    )
  }, [family.endpoints, query])

  if (query.trim() && filtered.length === 0) return null

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
        aria-expanded={open}
      >
        <span className="mt-0.5 text-muted-foreground" aria-hidden>
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{family.label}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {family.blurb}
          </span>
        </span>
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {filtered.length}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul
            key="branch"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/40 bg-muted/20"
          >
            {filtered.map((endpoint, i) => (
              <li key={endpoint.id} className="relative">
                <div
                  className="pointer-events-none absolute left-4 top-0 h-full w-px bg-border/70"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute left-4 top-1/2 h-px w-3 bg-border/70"
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => onSelect(endpoint.id)}
                  className={cn(
                    'ml-7 flex w-[calc(100%-1.75rem)] flex-col gap-0.5 border-l-2 px-2.5 py-2 text-left transition-colors',
                    selectedId === endpoint.id
                      ? 'border-l-primary bg-primary/8'
                      : 'border-l-transparent hover:bg-background/80',
                    i === filtered.length - 1 && 'mb-1',
                  )}
                >
                  <span className="text-[12px] font-medium text-foreground">{endpoint.title}</span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {endpoint.path}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function DetailPanel({
  endpoint,
  family,
  reduced,
}: {
  endpoint: ApiEndpointNode | null
  family: ApiFamilyNode | null
  reduced: boolean
}) {
  if (!endpoint || !family) {
    return (
      <div className="flex h-full flex-col justify-center gap-2 px-4 py-3 text-center">
        <Network className="mx-auto size-6 text-muted-foreground/60" aria-hidden />
        <p className="text-sm font-medium text-foreground">Select an API function</p>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Tap a leaf in the tree above. Each leaf is one HTTP endpoint your Ring clone can call —
          for people, payments, messaging, store, and ops.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      key={endpoint.id}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-3"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {family.label}
        </p>
        <h3 className="mt-0.5 text-base font-semibold leading-snug text-foreground">
          {endpoint.title}
        </h3>
        <p className="mt-1 break-all font-mono text-[11px] text-primary/90">{endpoint.path}</p>
      </div>
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Methods
        </p>
        <MethodBadges methods={endpoint.methods} />
      </div>
      <div className="min-h-0 flex-1">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          What it does
        </p>
        <p className="text-[13px] leading-relaxed text-foreground/90">{endpoint.summary}</p>
      </div>
      {(() => {
        const href = endpoint.docsHref ?? family.docsHref
        if (!href) return null
        const label =
          endpoint.docsHref != null
            ? 'Open procedure docs →'
            : family.docsLabel
              ? `${family.docsLabel} →`
              : 'Open related docs →'
        return (
          <Link
            href={href}
            className="text-[12px] font-medium text-primary underline-offset-2 hover:underline"
          >
            {label}
          </Link>
        )
      })()}
    </motion.div>
  )
}

export function RingApiTree({
  initialEndpointId = 'entities',
  className,
  title = 'Ring API tree',
}: RingApiTreeProps) {
  const reduced = useReducedMotion() ?? false
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(initialEndpointId)
  const [openFamilies, setOpenFamilies] = useState<Record<string, boolean>>(() => {
    const hit = findEndpoint(initialEndpointId)
    return hit ? { [hit.family.id]: true } : { entities: true }
  })

  const selected = selectedId ? findEndpoint(selectedId) : null

  const visibleFamilies = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return API_TREE_FAMILIES
    return API_TREE_FAMILIES.filter((f) =>
      f.endpoints.some(
        (e) =>
          e.path.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          f.label.toLowerCase().includes(q),
      ),
    )
  }, [query])

  const toggleFamily = (id: string) => {
    setOpenFamilies((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const onSelect = (id: string) => {
    setSelectedId(id)
    const hit = findEndpoint(id)
    if (hit) setOpenFamilies((prev) => ({ ...prev, [hit.family.id]: true }))
  }

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm',
        'aspect-[9/14]',
        className,
      )}
      role="region"
      aria-label={title}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-gradient-to-br from-muted/80 via-background to-muted/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-foreground/5 ring-1 ring-border">
              <Network className="size-4 text-foreground/80" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">{title}</p>
              <p className="text-[11px] text-muted-foreground">
                {API_TREE_ROUTE_COUNT} endpoints · {API_TREE_FAMILIES.length} families
              </p>
            </div>
          </div>
          <label className="relative mt-2 block">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search path or capability…"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-[12px] outline-none ring-primary/30 placeholder:text-muted-foreground/70 focus:ring-2"
            />
          </label>
        </div>

        {/* Upper tree — ~ square / majority of remaining height */}
        <div className="min-h-0 flex-[1.15] overflow-y-auto overscroll-contain">
          {visibleFamilies.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No matches.</p>
          ) : (
            visibleFamilies.map((family) => (
              <FamilyBranch
                key={family.id}
                family={family}
                open={Boolean(openFamilies[family.id]) || Boolean(query.trim())}
                onToggle={() => toggleFamily(family.id)}
                selectedId={selectedId}
                onSelect={onSelect}
                query={query}
              />
            ))
          )}
        </div>

        {/* Lower info panel */}
        <div className="min-h-0 flex-1 border-t border-border bg-muted/30">
          <DetailPanel
            endpoint={selected?.endpoint ?? null}
            family={selected?.family ?? null}
            reduced={reduced}
          />
        </div>
      </div>
    </div>
  )
}

export default RingApiTree
