import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { z } from 'zod'

/** E.164 or international-format phone validation via libphonenumber-js. */
export function isValidPhoneNumber(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const parsed = parsePhoneNumberFromString(trimmed)
  return parsed?.isValid() ?? false
}

export const phoneNumberSchema = z
  .string()
  .max(32)
  .refine(isValidPhoneNumber, { message: 'Invalid phone number' })
