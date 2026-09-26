import 'server-only'

import { db } from '@/lib/database'
import { CURTAIN_PREFS_COLLECTION } from '@/features/curtain/constants'
import { mergeCurtainPrefs, parseCurtainPrefs } from '@/features/curtain/lib/prefs-storage'
import type { CurtainPrefsDoc } from '@/features/curtain/types'

export async function loadCurtainPrefs(userId: string): Promise<CurtainPrefsDoc> {
  const result = await db().findDocById<Record<string, unknown>>(CURTAIN_PREFS_COLLECTION, userId)
  if (!result.success || !result.data) {
    return { offers: {}, updatedAt: new Date(0).toISOString() }
  }
  return parseCurtainPrefs(result.data)
}

export async function saveCurtainPrefs(userId: string, incoming: CurtainPrefsDoc): Promise<CurtainPrefsDoc> {
  const existing = await loadCurtainPrefs(userId)
  const merged = mergeCurtainPrefs(existing, incoming)
  const write = await db().updateDoc(CURTAIN_PREFS_COLLECTION, userId, merged)
  if (!write.success) {
    await db().createDoc(CURTAIN_PREFS_COLLECTION, merged, { id: userId })
  }
  return merged
}
