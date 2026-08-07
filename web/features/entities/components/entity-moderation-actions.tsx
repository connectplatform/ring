'use client'

import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { SerializedEntity } from '@/features/entities/types'
import {
  reportEntityAction,
  blockEntityAction,
  type EntityModerationActionState,
} from '@/app/_actions/entity-moderation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Ban, Flag } from 'lucide-react'

export default function EntityModerationActions({
  entity,
  isOwner,
}: {
  entity: SerializedEntity
  isOwner: boolean
}) {
  const t = useTranslations('modules.entities')
  const router = useRouter()
  const [reportOpen, setReportOpen] = useState(false)

  const [reportState, reportAction] = useActionState<
    EntityModerationActionState | null,
    FormData
  >(reportEntityAction, null)

  const [blockState, blockAction] = useActionState<
    EntityModerationActionState | null,
    FormData
  >(async (prev, formData) => {
    const result = await blockEntityAction(prev, formData)
    if (result.success) router.refresh()
    return result
  }, null)

  if (isOwner) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Flag className="w-3 h-3 mr-1" />
            {t('reportEntity', { defaultValue: 'Report' })}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reportEntityTitle', { defaultValue: 'Report entity' })}</DialogTitle>
            <DialogDescription>
              {t('reportEntityDescription', {
                defaultValue: 'Flag illegal or harmful content. Reports are reviewed and sent to the matcher moderation queue.',
              })}
            </DialogDescription>
          </DialogHeader>
          <form
            action={reportAction}
            className="space-y-4"
            onSubmit={() => {
              if (reportState?.success) setReportOpen(false)
            }}
          >
            <input type="hidden" name="entityId" value={entity.id} />
            <div>
              <Label>{t('reportCategory', { defaultValue: 'Category' })}</Label>
              <Select name="category" defaultValue="illegal" required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="illegal">{t('reportIllegal', { defaultValue: 'Illegal content' })}</SelectItem>
                  <SelectItem value="harassment">{t('reportHarassment', { defaultValue: 'Harassment' })}</SelectItem>
                  <SelectItem value="misleading">{t('reportMisleading', { defaultValue: 'Misleading' })}</SelectItem>
                  <SelectItem value="spam">{t('reportSpam', { defaultValue: 'Spam' })}</SelectItem>
                  <SelectItem value="other">{t('reportOther', { defaultValue: 'Other' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reason">{t('reportReason', { defaultValue: 'Details' })}</Label>
              <Textarea
                id="reason"
                name="reason"
                required
                minLength={10}
                rows={4}
                placeholder={t('reportReasonPlaceholder', {
                  defaultValue: 'Describe why this entity violates platform rules…',
                })}
              />
            </div>
            {reportState?.error && (
              <Alert variant="destructive">
                <AlertDescription>{reportState.error}</AlertDescription>
              </Alert>
            )}
            {reportState?.success && (
              <Alert>
                <AlertDescription>
                  {t('reportSuccess', { defaultValue: 'Report submitted. Thank you.' })}
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit">{t('submitReport', { defaultValue: 'Submit report' })}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <form action={blockAction}>
        <input type="hidden" name="entityId" value={entity.id} />
        <Button size="sm" variant="ghost" type="submit">
          <Ban className="w-3 h-3 mr-1" />
          {t('blockEntity', { defaultValue: 'Block' })}
        </Button>
      </form>

      {blockState?.error && (
        <p className="text-sm text-destructive w-full">{blockState.error}</p>
      )}
      {blockState?.success && (
        <p className="text-sm text-muted-foreground w-full">
          {t('blockSuccess', { defaultValue: 'Entity hidden from your search results.' })}
        </p>
      )}
    </div>
  )
}
