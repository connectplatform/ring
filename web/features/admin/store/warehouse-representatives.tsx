'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  saveWarehouseAssignmentAction,
  searchWarehouseUsersAction,
  type WarehouseAssignmentRow,
} from '@/app/_actions/admin-store-erp'

export function WarehouseRepresentatives({
  warehouseId,
  assignments,
  canEdit,
}: {
  warehouseId: string
  assignments: WarehouseAssignmentRow[]
  canEdit: boolean
}) {
  const t = useTranslations('modules.admin.storeHub')
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Array<{ id: string; email: string; name: string }>>([])
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  if (!canEdit && assignments.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('representatives')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignments.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
            <span>
              {row.name || row.email || row.userId} · {row.role === 'manager' ? t('roleManager') : t('roleWorker')}
              {row.active ? '' : ` · ${t('warehouseActive')}`}
            </span>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await saveWarehouseAssignmentAction({
                      warehouseId,
                      userId: row.userId,
                      role: row.role,
                      active: !row.active,
                      email: row.email,
                      name: row.name,
                    })
                    setMessage(t('saved'))
                  })
                }
              >
                {row.active ? t('deactivate') : t('warehouseActive')}
              </Button>
            ) : null}
          </div>
        ))}
        {canEdit ? (
          <div className="space-y-2">
            <Input
              value={query}
              placeholder={t('findUser')}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending || query.trim().length < 2}
              onClick={() =>
                startTransition(async () => {
                  setMatches(await searchWarehouseUsersAction(query))
                })
              }
            >
              {t('findUser')}
            </Button>
            {matches.map((user) => (
              <div key={user.id} className="flex flex-wrap gap-2">
                <span className="text-sm">{user.name} · {user.email}</span>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await saveWarehouseAssignmentAction({
                        warehouseId,
                        userId: user.id,
                        role: 'worker',
                        active: true,
                        email: user.email,
                        name: user.name,
                      })
                      setMessage(t('saved'))
                    })
                  }
                >
                  {t('roleWorker')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await saveWarehouseAssignmentAction({
                        warehouseId,
                        userId: user.id,
                        role: 'manager',
                        active: true,
                        email: user.email,
                        name: user.name,
                      })
                      setMessage(t('saved'))
                    })
                  }
                >
                  {t('roleManager')}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  )
}
