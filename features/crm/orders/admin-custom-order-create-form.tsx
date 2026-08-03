'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { CalculatorInputs } from '@/features/calculator/types'
import {
  PROJECT_HOSTING_IDS,
  PROJECT_MODULE_IDS,
  PROJECT_NICHE_IDS,
  PROJECT_SCALE_IDS,
  type ProjectHostingId,
  type ProjectModuleId,
  type ProjectNicheId,
  type ProjectScaleId,
} from '@/features/calculator/presets/project'
import { Loader2 } from 'lucide-react'

const emptyInputs = (): CalculatorInputs => ({
  niche: '',
  scale: 'small',
  modules: ['auth', 'entities'],
  externals: [],
  hosting: 'ringdom',
  branding: false,
  needHumanDev: true,
})

/**
 * Admin custom-order create — same CalculatorInputs shape as /calculator OrderThisBuildButton.
 */
export function AdminCustomOrderCreateForm({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [buyerUserId, setBuyerUserId] = useState('')
  const [inputs, setInputs] = useState<CalculatorInputs>(emptyInputs)
  const [markPaid, setMarkPaid] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(
    () => Boolean(buyerUserId.trim() && inputs.niche && inputs.scale && inputs.hosting),
    [buyerUserId, inputs],
  )

  const toggleModule = (id: ProjectModuleId) => {
    setInputs((prev) => ({
      ...prev,
      modules: prev.modules.includes(id)
        ? prev.modules.filter((m) => m !== id)
        : [...prev.modules, id],
    }))
  }

  const onCreate = () => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/crm/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: buyerUserId.trim(),
            inputs,
            markPaid,
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.orderId) {
          throw new Error(json.error || 'Create failed')
        }
        setOpen(false)
        setBuyerUserId('')
        setInputs(emptyInputs())
        setMarkPaid(false)
        router.push(ROUTES.ADMIN_CRM_ORDER(json.orderId, locale))
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Create failed')
      }
    })
  }

  if (!open) {
    return (
      <Button size="sm" type="button" onClick={() => setOpen(true)}>
        New custom order
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Create custom order</CardTitle>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="buyerUserId">Buyer user ID</Label>
          <Input
            id="buyerUserId"
            placeholder="UUID of the member who owns this order"
            value={buyerUserId}
            onChange={(e) => setBuyerUserId(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Niche</Label>
            <Select
              value={inputs.niche || undefined}
              onValueChange={(v) => setInputs((p) => ({ ...p, niche: v as ProjectNicheId }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Niche" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_NICHE_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Scale</Label>
            <Select
              value={inputs.scale || undefined}
              onValueChange={(v) => setInputs((p) => ({ ...p, scale: v as ProjectScaleId }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Scale" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_SCALE_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Hosting</Label>
            <Select
              value={inputs.hosting || undefined}
              onValueChange={(v) => setInputs((p) => ({ ...p, hosting: v as ProjectHostingId }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Hosting" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_HOSTING_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Modules</Label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_MODULE_IDS.map((id) => {
              const on = inputs.modules.includes(id)
              return (
                <Button
                  key={id}
                  size="sm"
                  type="button"
                  variant={on ? 'default' : 'outline'}
                  onClick={() => toggleModule(id)}
                >
                  {id}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={inputs.branding}
              onCheckedChange={(v) => setInputs((p) => ({ ...p, branding: v }))}
            />
            <Label>Branding</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={inputs.needHumanDev}
              onCheckedChange={(v) => setInputs((p) => ({ ...p, needHumanDev: v }))}
            />
            <Label>Need human integrator</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={markPaid} onCheckedChange={setMarkPaid} />
            <Label>Mark paid (admin / comp)</Label>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button disabled={!canSubmit || pending} type="button" onClick={onCreate}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create order
        </Button>
      </CardContent>
    </Card>
  )
}
