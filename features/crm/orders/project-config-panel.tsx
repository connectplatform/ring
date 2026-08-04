'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Palette } from 'lucide-react'
import type { OrderProjectConfig } from '@/features/crm/orders/order-project-config'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'
import { labFieldClassName, toneForEmpty } from '@/features/crm/lab/lab-field-tone'
import { useOptionalOrderLabTabStatus } from '@/features/crm/lab/order-lab-tab-status-context'
import { computeOrderLabTabStatuses } from '@/features/crm/lab/order-lab-tab-status'
import type { ProjectOrder } from '@/features/crm/orders/types'

type Mode = 'buyer' | 'integrator'

function empty(v: string | undefined | null): boolean {
  return !v || !String(v).trim()
}

/**
 * Order Project Config panel — buyer vital fields or integrator full allowlist.
 */
export function ProjectConfigPanel({
  orderId,
  mode,
}: {
  orderId: string
  mode: Mode
}) {
  const t = useTranslations('calculator')
  const tabStatus = useOptionalOrderLabTabStatus()
  const [pending, startTransition] = useTransition()
  const [config, setConfig] = useState<OrderProjectConfig>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const apiBase =
    mode === 'buyer' ? `/api/my-orders/${orderId}/project-config` : `/api/my-jobs/${orderId}/project-config`

  const bumpProjectTab = useCallback(
    (next: OrderProjectConfig) => {
      if (!tabStatus) return
      const computed = computeOrderLabTabStatuses({
        order: { id: orderId } as ProjectOrder,
        projectConfig: next,
      })
      if (computed.project) tabStatus.setTabStatus('project', computed.project)
    },
    [orderId, tabStatus],
  )

  const load = useCallback(async () => {
    const { ok, data, error: parseErr } = await fetchJsonSafe<{
      error?: string
      projectConfig?: OrderProjectConfig
    }>(apiBase)
    if (!ok || !data) throw new Error(parseErr || data?.error || 'Failed to load project config')
    if (data.error) throw new Error(data.error)
    setConfig(data.projectConfig || {})
  }, [apiBase])

  useEffect(() => {
    startTransition(() => {
      void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
    })
  }, [load])

  const patch = (partial: OrderProjectConfig) => {
    setConfig((c) => ({
      ...c,
      ...partial,
      clone: { ...c.clone, ...partial.clone },
      branding: {
        ...c.branding,
        ...partial.branding,
        colors: { ...c.branding?.colors, ...partial.branding?.colors },
      },
      seo: { ...c.seo, ...partial.seo },
      contact: { ...c.contact, ...partial.contact },
    }))
    setSaved(false)
  }

  const onSave = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const { ok, data, error: parseErr } = await fetchJsonSafe<{
          error?: string
          projectConfig?: OrderProjectConfig
        }>(apiBase, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectConfig: config }),
        })
        if (!ok || !data) throw new Error(parseErr || data?.error || 'Save failed')
        if (data.error) throw new Error(data.error)
        const next = data.projectConfig || {}
        setConfig(next)
        setSaved(true)
        bumpProjectTab(next)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
        tabStatus?.markTabError('project', e instanceof Error ? e.message : 'save_failed')
      }
    })
  }

  return (
    <Card id="project-config">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4" />
          {t('order.projectConfig.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {mode === 'buyer'
            ? t('order.projectConfig.buyerSubtitle')
            : t('order.projectConfig.integratorSubtitle')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? (
          <p className="text-sm text-muted-foreground">{t('order.projectConfig.savedBanner')}</p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>{t('order.projectConfig.displayName')}</Label>
            <Input
              className={labFieldClassName(
                toneForEmpty({ empty: empty(config.clone?.displayName), required: true }),
              )}
              disabled={pending}
              value={config.clone?.displayName || ''}
              onChange={(e) => patch({ clone: { displayName: e.target.value } })}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('order.projectConfig.shortName', { defaultValue: 'Short name' })}</Label>
            <Input
              className={labFieldClassName(
                toneForEmpty({ empty: empty(config.clone?.shortName), required: true }),
              )}
              disabled={pending}
              value={config.clone?.shortName || ''}
              onChange={(e) => patch({ clone: { shortName: e.target.value } })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>{t('order.projectConfig.slogan')}</Label>
            <Input
              className={labFieldClassName(
                toneForEmpty({ empty: empty(config.branding?.slogan), recommended: true }),
              )}
              disabled={pending}
              value={config.branding?.slogan || ''}
              onChange={(e) => patch({ branding: { slogan: e.target.value } })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>{t('order.projectConfig.description')}</Label>
          <Textarea
            className={labFieldClassName(
              toneForEmpty({
                empty: empty(config.clone?.description || config.branding?.extendedDescription),
                required: true,
              }),
            )}
            disabled={pending}
            rows={3}
            value={config.clone?.description || config.branding?.extendedDescription || ''}
            onChange={(e) =>
              patch({
                clone: { description: e.target.value },
                branding: { extendedDescription: e.target.value },
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Label>{t('order.projectConfig.logoUrl')}</Label>
          <Input
            className={labFieldClassName(
              toneForEmpty({ empty: empty(config.branding?.logoUrl), recommended: true }),
            )}
            disabled={pending}
            placeholder="https://"
            value={config.branding?.logoUrl || ''}
            onChange={(e) => patch({ branding: { logoUrl: e.target.value } })}
          />
        </div>

        {mode === 'integrator' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t('order.projectConfig.primaryColor')}</Label>
                <Input
                  className={labFieldClassName(
                    toneForEmpty({
                      empty: empty(config.branding?.colors?.primary),
                      recommended: true,
                    }),
                  )}
                  disabled={pending}
                  value={config.branding?.colors?.primary || ''}
                  onChange={(e) =>
                    patch({ branding: { colors: { primary: e.target.value } } })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>{t('order.projectConfig.accentColor')}</Label>
                <Input
                  disabled={pending}
                  value={config.branding?.colors?.accent || ''}
                  onChange={(e) =>
                    patch({ branding: { colors: { accent: e.target.value } } })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>{t('order.projectConfig.contactEmail')}</Label>
                <Input
                  disabled={pending}
                  value={config.clone?.contactEmail || config.contact?.email || ''}
                  onChange={(e) =>
                    patch({
                      clone: { contactEmail: e.target.value },
                      contact: { email: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>{t('order.projectConfig.seoTitle')}</Label>
                <Input
                  disabled={pending}
                  value={config.seo?.titleSuffix || ''}
                  onChange={(e) => patch({ seo: { titleSuffix: e.target.value } })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('order.projectConfig.ogImage')}</Label>
              <Input
                disabled={pending}
                value={config.branding?.ogImageUrl || ''}
                onChange={(e) => patch({ branding: { ogImageUrl: e.target.value } })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Home preset</Label>
                <Input
                  className={labFieldClassName(
                    toneForEmpty({ empty: empty(config.home?.preset), recommended: true }),
                  )}
                  disabled={pending}
                  placeholder="n9life-landing"
                  value={config.home?.preset || ''}
                  onChange={(e) => patch({ home: { preset: e.target.value } })}
                />
              </div>
              <div className="space-y-1">
                <Label>Entities preset</Label>
                <Input
                  className={labFieldClassName(
                    toneForEmpty({ empty: empty(config.entities?.preset), recommended: true }),
                  )}
                  disabled={pending}
                  placeholder="platform"
                  value={config.entities?.preset || ''}
                  onChange={(e) => patch({ entities: { preset: e.target.value } })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Domain feature id (Tier-3)</Label>
                <Input
                  className={labFieldClassName(
                    toneForEmpty({ empty: empty(config.domainFeatureId), recommended: true }),
                  )}
                  disabled={pending}
                  placeholder="n9life"
                  value={config.domainFeatureId || ''}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      domainFeatureId: e.target.value.trim() || undefined,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Clone Tier-3 lives under features/&lt;id&gt; + lib/overlay/registry — see playbook.
                </p>
              </div>
            </div>
          </>
        ) : null}

        <Button disabled={pending} size="sm" type="button" onClick={onSave}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('order.projectConfig.save')}
        </Button>
      </CardContent>
    </Card>
  )
}
