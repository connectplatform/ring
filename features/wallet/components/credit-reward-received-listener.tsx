'use client'

/**
 * Listens for REWARD_CREDIT_RECEIVED on notifications:inbox.
 * Shows toast + celebration fs-modal. CreditBalanceProvider already refreshes
 * via credit:balance after addCredits — this layer is UX only.
 */

import { useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import { toast } from '@/hooks/use-toast'
import { NotificationType } from '@/features/notifications/types'
import CreditRewardReceivedFsModal from '@/features/wallet/components/credit-reward-received-fs-modal'
import { getClientCreditUnitLabel } from '@/lib/ring-config-client'

type InboxPayload = {
  type?: string
  action?: string
  notification?: {
    id: string
    type?: string
    title?: string
    body?: string
    data?: {
      amount?: string
      unitLabel?: string
      currency?: string
      rewardAction?: string
      rewardTrigger?: string
      metadata?: { openCelebrationModal?: boolean; kind?: string }
    }
  }
}

export function CreditRewardReceivedListener() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('0')
  const [unitLabel, setUnitLabel] = useState(getClientCreditUnitLabel())
  const [rewardAction, setRewardAction] = useState('')

  const onMessage = useCallback((payload: InboxPayload) => {
    const incoming = payload?.notification
    if (!incoming?.id) return
    if (incoming.type !== NotificationType.REWARD_CREDIT_RECEIVED) return

    const data = incoming.data ?? {}
    const amt = data.amount ?? '0'
    const unit = data.unitLabel || data.currency || getClientCreditUnitLabel()
    const action = data.rewardAction || data.rewardTrigger || 'quest'

    setAmount(amt)
    setUnitLabel(unit)
    setRewardAction(action)
    setOpen(true)

    toast({
      title: incoming.title || `${unit} received`,
      description: incoming.body || `+${amt} ${unit}`,
    })
  }, [])

  useTunnelChannel<InboxPayload>({
    channel: 'notifications:inbox',
    enabled: Boolean(session?.user?.id),
    onMessage,
  })

  return (
    <CreditRewardReceivedFsModal
      open={open}
      onOpenChange={setOpen}
      amount={amount}
      unitLabel={unitLabel}
      rewardAction={rewardAction}
    />
  )
}
