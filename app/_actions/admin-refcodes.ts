'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'

async function assertAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error('Authentication required')
  if (!isPlatformAdmin(session.user.role)) throw new Error('Admin access required')
  return session.user.id
}

export async function approveReferralReward(formData: FormData) {
  try {
    const adminId = await assertAdmin()
    const rewardId = formData.get('rewardId') as string
    if (!rewardId) throw new Error('Reward ID required')

    const result = await ReferralRewardService.approveReward(rewardId, adminId)
    revalidatePath('/admin/refcodes')
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Approval failed',
    }
  }
}

export async function rejectReferralReward(formData: FormData) {
  try {
    const adminId = await assertAdmin()
    const rewardId = formData.get('rewardId') as string
    if (!rewardId) throw new Error('Reward ID required')

    await ReferralRewardService.rejectReward(rewardId, adminId)
    revalidatePath('/admin/refcodes')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Rejection failed',
    }
  }
}
