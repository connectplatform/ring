'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import VitalsOnboardingForm, {
  type VitalsRewardHint,
} from '@/features/auth/components/vitals-onboarding-form'

export default function VitalsOnboardingClient({
  creditBalanceUnitLabel,
  rewardHints,
  callbackUrl,
}: {
  creditBalanceUnitLabel: string
  rewardHints: VitalsRewardHint[]
  callbackUrl: string
}) {
  const router = useRouter()
  const onComplete = useCallback(() => {
    router.replace(callbackUrl)
  }, [router, callbackUrl])

  return (
    <VitalsOnboardingForm
      creditBalanceUnitLabel={creditBalanceUnitLabel}
      rewardHints={rewardHints}
      onComplete={onComplete}
    />
  )
}
