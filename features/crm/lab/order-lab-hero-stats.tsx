'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { DavinciGlassStatBlock } from '@/lib/ui/davinci'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'
import { useOptionalOrderLabTabStatus } from '@/features/crm/lab/order-lab-tab-status-context'
import { cn } from '@/lib/utils'

type StatusPayload = {
  success?: boolean
  deployment?: {
    lastDeployStatus?: string
    lastError?: string | null
    namespace?: string
    projectUrl?: string | null
  }
  pods?: { total: number; ready: number; restarts: number }
  health?: {
    status: string
    database?: string | null
    responseMs?: number | null
  }
}

export function OrderLabHeroStats({
  orderId,
  className,
}: {
  orderId: string
  className?: string
}) {
  const t = useTranslations('calculator')
  const tabCtx = useOptionalOrderLabTabStatus()
  const heroEpoch = tabCtx?.heroEpoch ?? 0
  const [data, setData] = useState<StatusPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchJsonSafe<StatusPayload>(`/api/my-jobs/${orderId}/deployment/status`)
      .then((res) => {
        if (!cancelled && res.data) setData(res.data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [orderId, heroEpoch])

  const pods = data?.pods
  const health = data?.health
  const deploy = data?.deployment

  const podsValue =
    pods == null ? '—' : `${pods.ready}/${pods.total || 0}`
  const restartsValue = pods == null ? '—' : String(pods.restarts ?? 0)
  const deployValue = deploy?.lastDeployStatus || 'idle'
  const dbValue =
    health?.status === 'not_deployed'
      ? t('order.lab.hero.notDeployed', { defaultValue: 'n/a' })
      : health?.database || health?.status || '—'

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2 sm:grid-cols-4',
        className,
      )}
    >
      <DavinciGlassStatBlock
        beamOnHover={false}
        value={podsValue}
        label={t('order.lab.hero.pods', { defaultValue: 'Pods ready' })}
        hint={
          deploy?.namespace
            ? deploy.namespace
            : t('order.lab.hero.noNamespace', { defaultValue: 'No namespace' })
        }
      />
      <DavinciGlassStatBlock
        beamOnHover={false}
        value={restartsValue}
        label={t('order.lab.hero.restarts', { defaultValue: 'Restarts' })}
      />
      <DavinciGlassStatBlock
        beamOnHover={false}
        value={deployValue}
        label={t('order.lab.hero.deploy', { defaultValue: 'Deploy' })}
        hint={deploy?.lastError || undefined}
      />
      <DavinciGlassStatBlock
        beamOnHover={false}
        value={String(dbValue)}
        label={t('order.lab.hero.db', { defaultValue: 'DB / health' })}
        hint={
          health?.responseMs != null
            ? `${health.responseMs}ms`
            : health?.status === 'unreachable'
              ? t('order.lab.hero.unreachable', { defaultValue: 'Unreachable' })
              : undefined
        }
      />
    </div>
  )
}
