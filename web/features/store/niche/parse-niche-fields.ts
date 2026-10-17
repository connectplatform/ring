/**
 * L1 stub — platform store has no niche product fields.
 * L2 packs overwrite this file and return `{ nichePreset, nicheData }`.
 */

export type NicheFieldParse = {
  nichePreset?: string
  nicheData?: Record<string, unknown>
}

export function parseNicheProductFields(
  _formData: FormData,
  _existing?: NicheFieldParse,
): NicheFieldParse {
  return {}
}
