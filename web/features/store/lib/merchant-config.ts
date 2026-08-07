import { db } from '@/lib/database'
import type { MerchantConfiguration } from '@/features/store/types/vendor'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'

export async function getMerchantConfigByEntityId(
  entityId: string,
): Promise<MerchantConfiguration | null> {
  const result = await db().queryDocs<MerchantConfiguration & { id: string }>({
    collection: STORE_COLLECTIONS.merchantConfigs,
    filters: [{ field: 'ownerEntityId', operator: '=', value: entityId }],
    pagination: { limit: 1 },
  })
  if (!result.success || result.data.length === 0) return null
  return result.data[0] as MerchantConfiguration
}
