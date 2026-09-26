import 'server-only'

import { cookies } from 'next/headers'
import { CURTAIN_ATTR_COOKIE } from '@/features/curtain/constants'
import { parseCurtainAttributionJson } from '@/features/curtain/lib/attribution-storage'
import type { CurtainAttributionTouch } from '@/features/curtain/types'

export async function readCurtainAttributionFromCookies(): Promise<CurtainAttributionTouch[]> {
  const store = await cookies()
  return parseCurtainAttributionJson(store.get(CURTAIN_ATTR_COOKIE)?.value)
}
