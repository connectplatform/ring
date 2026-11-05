'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createWarehouseAction,
  deleteWarehouseAction,
  updateWarehouseAction,
  type WarehouseDirectoryRow,
} from '@/app/_actions/admin-store-erp'
import Link from 'next/link'
import { ZERO_WAREHOUSE_ID } from '@/features/store/constants/stock'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

function actionMessage(error: unknown, blocked: string, failed: string): string {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('cannot be deleted')) return blocked
  return failed
}

export function WarehousesEditor({
  initialWarehouses,
  locale,
}: {
  initialWarehouses: WarehouseDirectoryRow[]
  locale: Locale
}) {
  const t = useTranslations('modules.admin.storeHub')
  const [rows, setRows] = useState(initialWarehouses)
  const [drafts, setDrafts] = useState<Record<string, WarehouseDirectoryRow>>({})
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [address, setAddress] = useState('')
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const draftOf = (row: WarehouseDirectoryRow) => drafts[row.id] ?? row

  const patchDraft = (row: WarehouseDirectoryRow, patch: Partial<WarehouseDirectoryRow>) => {
    setDrafts((current) => ({
      ...current,
      [row.id]: { ...(current[row.id] ?? row), ...patch },
    }))
  }

  const saveRow = (row: WarehouseDirectoryRow) => {
    const draft = draftOf(row)
    setMessage(null)
    startTransition(async () => {
      try {
        const next = await updateWarehouseAction({
          id: row.id,
          name: draft.name,
          code: draft.code,
          address: draft.address,
          active: row.isDefault ? true : draft.active,
        })
        setRows(next)
        setDrafts((current) => {
          const rest = { ...current }
          delete rest[row.id]
          return rest
        })
        setMessage(t('saved'))
      } catch (error) {
        setMessage(actionMessage(error, t('warehouseDeleteBlocked'), t('saveFailed')))
      }
    })
  }

  const createRow = () => {
    setMessage(null)
    startTransition(async () => {
      try {
        const next = await createWarehouseAction({ name, code, address })
        setRows(next)
        setName('')
        setCode('')
        setAddress('')
        setMessage(t('saved'))
      } catch {
        setMessage(t('saveFailed'))
      }
    })
  }

  const deleteRow = (row: WarehouseDirectoryRow) => {
    setMessage(null)
    startTransition(async () => {
      try {
        const next = await deleteWarehouseAction(row.id)
        setRows(next)
        setMessage(t('saved'))
      } catch (error) {
        setMessage(actionMessage(error, t('warehouseDeleteBlocked'), t('saveFailed')))
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">{t('warehousesTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('warehousesHint')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('addWarehouse')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="warehouse-name">{t('warehouseName')}</Label>
            <Input
              id="warehouse-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="warehouse-code">{t('warehouseCode')}</Label>
            <Input
              id="warehouse-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="warehouse-address">{t('warehouseAddress')}</Label>
            <Input
              id="warehouse-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div>
            <Button type="button" onClick={createRow} disabled={pending || !name.trim() || !code.trim()}>
              {pending ? t('saving') : t('save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {rows.map((row) => {
          const draft = draftOf(row)
          const locked = row.isDefault || row.id === ZERO_WAREHOUSE_ID
          return (
            <Card key={row.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-base">
                  <Link className="underline" href={ROUTES.ADMIN_STORE_WAREHOUSE(row.id, locale)}>
                    {draft.name || row.name}
                  </Link>
                </CardTitle>
                {row.isDefault ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t('warehouseDefault')}
                  </span>
                ) : null}
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <p className="text-xs text-muted-foreground sm:col-span-2">{row.id}</p>
                <div className="space-y-2">
                  <Label htmlFor={`${row.id}-name`}>{t('warehouseName')}</Label>
                  <Input
                    id={`${row.id}-name`}
                    value={draft.name}
                    onChange={(event) => patchDraft(row, { name: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${row.id}-code`}>{t('warehouseCode')}</Label>
                  <Input
                    id={`${row.id}-code`}
                    value={draft.code}
                    onChange={(event) => patchDraft(row, { code: event.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${row.id}-address`}>{t('warehouseAddress')}</Label>
                  <Input
                    id={`${row.id}-address`}
                    value={draft.address}
                    onChange={(event) => patchDraft(row, { address: event.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={locked ? true : draft.active}
                    disabled={locked || pending}
                    onChange={(event) => {
                      const active = event.target.checked
                      patchDraft(row, { active })
                      setMessage(null)
                      startTransition(async () => {
                        try {
                          const next = await updateWarehouseAction({
                            id: row.id,
                            name: draft.name.trim() ? draft.name : row.name,
                            code: draft.code.trim() ? draft.code : row.code,
                            address: draft.address,
                            active,
                          })
                          setRows(next)
                          setDrafts((current) => {
                            const rest = { ...current }
                            delete rest[row.id]
                            return rest
                          })
                          setMessage(t('saved'))
                        } catch (error) {
                          patchDraft(row, { active: row.active })
                          setMessage(actionMessage(error, t('warehouseDeleteBlocked'), t('saveFailed')))
                        }
                      })
                    }}
                  />
                  {t('warehouseActive')}
                </label>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <Button type="button" onClick={() => saveRow(row)} disabled={pending}>
                    {pending ? t('saving') : t('save')}
                  </Button>
                  {locked ? null : (
                    <Button type="button" variant="outline" onClick={() => deleteRow(row)} disabled={pending}>
                      {t('remove')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}
