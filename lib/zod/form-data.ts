import { z } from 'zod'

/** Shared FormData → plain object helper for Zod server-action validation. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  formData.forEach((value, key) => {
    if (typeof value === 'string' && !(key in out)) out[key] = value
  })
  return out
}

export function parseFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const parsed = schema.safeParse(formDataToObject(formData))
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ')
    return { success: false as const, error: msg || 'Invalid form data' }
  }
  return { success: true as const, data: parsed.data }
}
