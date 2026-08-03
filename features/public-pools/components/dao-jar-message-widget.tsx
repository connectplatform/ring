'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Coins, ExternalLink, PiggyBank } from 'lucide-react'
import type { DaoJarMetadata, Message } from '@/features/chat/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import { useLocale } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { PoolContributePanel } from '@/features/public-pools/components/pool-contribute-panel'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'

function parseDaoJar(message: Message): DaoJarMetadata | null {
  const meta = message.metadata
  if (!meta || meta.kind !== 'dao_jar') return null
  if (typeof meta.poolSlug !== 'string' || typeof meta.title !== 'string') return null
  return meta as unknown as DaoJarMetadata
}

export interface DaoJarMessageWidgetProps {
  message: Message
  isOwn: boolean
  className?: string
}

export function DaoJarMessageWidget({ message, className }: DaoJarMessageWidgetProps) {
  const locale = useLocale() as Locale
  const tokenSymbol = getClientNativeTokenSymbol()
  const base = parseDaoJar(message)
  const [local, setLocal] = useState<DaoJarMetadata | null>(null)
  const [chipOpen, setChipOpen] = useState(false)
  const jar = local ?? base

  if (!jar) {
    return <div className="whitespace-pre-wrap">{message.content}</div>
  }

  const canContribute =
    jar.status === 'open' || jar.status === 'queued' || jar.status === 'in_progress'
  const daoHref = ROUTES.DAO_POOL(jar.poolSlug, locale)

  return (
    <div
      className={cn(
        'min-w-[240px] space-y-2 rounded-md border border-border/50 bg-background/40 p-3',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <PiggyBank className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium leading-snug">{jar.title}</p>
          <p className="text-[11px] opacity-70">
            {jar.pledgedRing} / {jar.goalRing} {tokenSymbol} · {jar.status}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs">
          <Link href={daoHref}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Open jar
          </Link>
        </Button>
        {canContribute ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => setChipOpen((v) => !v)}
          >
            <Coins className="h-3.5 w-3.5" aria-hidden />
            Chip in
          </Button>
        ) : null}
      </div>

      {chipOpen ? (
        <PoolContributePanel
          poolSlug={jar.poolSlug}
          locale={locale}
          needSummary={jar.title}
          onCancel={() => setChipOpen(false)}
          onNativeTokenSuccess={async () => {
            // Parent message refresh via tunnel; keep local progress optimistic if present
            setLocal((prev) => prev)
          }}
        />
      ) : null}
    </div>
  )
}

export default DaoJarMessageWidget
