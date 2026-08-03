'use client'

import Link from 'next/link'
import { ExternalLink, Share2 } from 'lucide-react'
import type { Message, ShareCardMetadata } from '@/features/chat/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function parseShareCard(message: Message): ShareCardMetadata | null {
  const meta = message.metadata
  if (!meta || meta.kind !== 'share_card') return null
  if (typeof meta.title !== 'string' || typeof meta.url !== 'string') return null
  return meta as unknown as ShareCardMetadata
}

export interface ShareCardMessageWidgetProps {
  message: Message
  isOwn: boolean
  className?: string
}

export function ShareCardMessageWidget({
  message,
  isOwn,
  className,
}: ShareCardMessageWidgetProps) {
  const card = parseShareCard(message)
  if (!card) {
    return <div className="whitespace-pre-wrap">{message.content}</div>
  }

  return (
    <div
      className={cn(
        'min-w-[220px] space-y-2 rounded-md border border-border/50 bg-background/40 p-3',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Share2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug">{card.title}</p>
          {card.commit?.sha ? (
            <p className="font-mono text-[10px] opacity-70">
              {card.commit.path} · {card.commit.sha.slice(0, 7)}
            </p>
          ) : null}
          {card.description ? (
            <p className="line-clamp-3 text-xs opacity-80">{card.description}</p>
          ) : null}
        </div>
      </div>
      <Button asChild size="sm" variant={isOwn ? 'secondary' : 'default'} className="h-8 gap-1 text-xs">
        <Link href={card.url}>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Open
        </Link>
      </Button>
    </div>
  )
}

export default ShareCardMessageWidget
