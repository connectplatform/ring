import { createHash } from 'crypto'

/** Stable contact document id from email address. */
export function contactIdForEmail(email: string): string {
  const normalized = email.toLowerCase().trim()
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  return `contact_${hash}`
}
