'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Conversation, TaskMetadata } from '@/features/chat/types'
import { createTaskMessage } from '@/app/_actions/tasks'
import { followCheckoutResult } from '@/lib/payments/checkout-redirect'
import { getClientMainCurrency } from '@/lib/ring-config-client'
import type { Locale } from '@/i18n/shared'
import type { ValueDenomination } from '@/lib/value-denomination'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, ListTodo } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export interface TaskComposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversation: Conversation
  currentUserId: string
  onSuccess?: () => void
}

const UNASSIGNED = '__unassigned__'

export function TaskComposeDialog({
  open,
  onOpenChange,
  conversation,
  currentUserId,
  onSuccess,
}: TaskComposeDialogProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('modules.tasks')
  const tCommon = useTranslations('common')
  const [description, setDescription] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState<string>(UNASSIGNED)
  const [deadline, setDeadline] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetUnit, setBudgetUnit] = useState<ValueDenomination>('credit_balance')
  const [escrowEnabled, setEscrowEnabled] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const participantOptions = useMemo(
    () =>
      conversation.participants
        .filter((p) => p.userId !== currentUserId)
        .map((p) => ({
          userId: p.userId,
          label: p.displayName || p.userId,
        })),
    [conversation.participants, currentUserId],
  )

  useEffect(() => {
    if (!open) return
    if (conversation.type === 'direct' && participantOptions.length === 1) {
      setAssigneeUserId(participantOptions[0].userId)
    } else {
      setAssigneeUserId(UNASSIGNED)
    }
  }, [open, conversation.type, participantOptions])

  const resetForm = () => {
    setDescription('')
    setDeadline('')
    setBudgetAmount('')
    setBudgetUnit('credit_balance')
    setEscrowEnabled(false)
    if (conversation.type === 'direct' && participantOptions.length === 1) {
      setAssigneeUserId(participantOptions[0].userId)
    } else {
      setAssigneeUserId(UNASSIGNED)
    }
  }

  const buildBudget = (): TaskMetadata['budget'] | undefined => {
    const amount = parseFloat(budgetAmount)
    if (!Number.isFinite(amount) || amount <= 0) return undefined

    switch (budgetUnit) {
      case 'credit_balance':
        return {
          amount,
          currencyType: 'credit_balance',
          displayUnit: 'credit_balance',
        }
      case 'native_token':
        return {
          amount,
          currencyType: 'native_token',
          displayUnit: 'native_token',
        }
      case 'main_currency':
        return {
          amount,
          currencyType: 'main_currency',
          currencyCode: getClientMainCurrency(),
          displayUnit: 'main_currency',
        }
      default:
        return undefined
    }
  }

  const budgetPreview = buildBudget()
  const canEscrow = Boolean(budgetPreview)

  useEffect(() => {
    if (!canEscrow && escrowEnabled) {
      setEscrowEnabled(false)
    }
  }, [canEscrow, escrowEnabled])

  const checkoutRail = (): 'card' | 'native_token' | undefined => {
    if (!budgetPreview) return undefined
    if (budgetPreview.currencyType === 'native_token') return 'native_token'
    if (budgetPreview.currencyType === 'main_currency') return 'card'
    return undefined
  }

  const handleSubmit = async () => {
    const trimmed = description.trim()
    if (!trimmed) {
      toast({
        title: t('description'),
        description: t('descriptionPlaceholder'),
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      const result = await createTaskMessage({
        conversationId: conversation.id,
        content: trimmed,
        assigneeUserId: assigneeUserId === UNASSIGNED ? null : assigneeUserId,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        budget: buildBudget(),
        escrowEnabled,
      })

      if (!result.success) {
        throw new Error(result.error || t('createFailed'))
      }

      if (result.needsCheckout && result.escrowId) {
        const checkoutRes = await fetch(
          `/api/tasks/escrow/${encodeURIComponent(result.escrowId)}/checkout`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rail: checkoutRail(),
              locale,
              returnConversationId: conversation.id,
            }),
          },
        )
        const checkoutJson = await checkoutRes.json()
        if (!checkoutRes.ok) {
          throw new Error(checkoutJson.error || t('createFailed'))
        }
        if (checkoutJson.paid) {
          toast({ title: t('created') })
        } else if (checkoutJson.redirect || checkoutJson.paymentUrl) {
          toast({ title: t('creating') })
          followCheckoutResult(checkoutJson)
          resetForm()
          onOpenChange(false)
          onSuccess?.()
          return
        }
      }

      toast({ title: t('created') })
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast({
        title: tCommon('status.error'),
        description: error instanceof Error ? error.message : t('createFailed'),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            {t('createTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-description">{t('description')}</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('assignee')}</Label>
            <Select value={assigneeUserId} onValueChange={setAssigneeUserId}>
              <SelectTrigger>
                <SelectValue placeholder={t('unassigned')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>{t('unassigned')}</SelectItem>
                {participantOptions.map((p) => (
                  <SelectItem key={p.userId} value={p.userId}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-deadline">{t('deadline')}</Label>
            <Input
              id="task-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-budget">{t('budget')}</Label>
              <Input
                id="task-budget"
                type="number"
                min="0"
                step="any"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('budgetUnit')}</Label>
              <Select
                value={budgetUnit}
                onValueChange={(v) => setBudgetUnit(v as ValueDenomination)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_balance">{t('unitCredit')}</SelectItem>
                  <SelectItem value="native_token">{t('unitNative')}</SelectItem>
                  <SelectItem value="main_currency">{t('unitMainCurrency')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            className={cn(
              'flex items-center justify-between rounded-md border p-3',
              !canEscrow && 'opacity-60',
            )}
          >
            <div>
              <p className="text-sm font-medium">{t('escrow')}</p>
              <p className="text-xs text-muted-foreground">
                {canEscrow ? t('escrowHint') : t('escrowNeedsBudget')}
              </p>
            </div>
            <Switch
              checked={escrowEnabled}
              onCheckedChange={setEscrowEnabled}
              disabled={!canEscrow}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitting ? t('creating') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TaskComposeDialog
