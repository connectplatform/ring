/**
 * Resolve CRM support desk user ids from CRM_SUPPORT_DESK_USER_IDS (comma-separated).
 */
export function resolveSupportDeskUserIds(): string[] {
  const raw = process.env.CRM_SUPPORT_DESK_USER_IDS || ''
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))]
}
