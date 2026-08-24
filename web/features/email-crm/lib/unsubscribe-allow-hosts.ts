import { getSystemConfigSnapshot } from '@/lib/ring-config'
import {
  RFC8058_DEFAULT_ALLOW_HOSTS,
  normalizeAllowHost,
} from '@/features/email-crm/lib/unsubscribe-rfc8058'

/** Built-in ESP suffixes plus optional ring-config.emailCrm.unsubscribeAllowHosts. */
export function getConfiguredUnsubscribeAllowHosts(): string[] {
  const extra = getSystemConfigSnapshot().emailCrm?.unsubscribeAllowHosts ?? []
  return [
    ...new Set([
      ...RFC8058_DEFAULT_ALLOW_HOSTS,
      ...extra.map(normalizeAllowHost).filter(Boolean),
    ]),
  ]
}
