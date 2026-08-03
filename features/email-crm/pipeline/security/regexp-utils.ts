/**
 * RegExp helpers for email CRM security layers.
 * Always clone with a global flag so matchAll never inherits a sticky lastIndex.
 */

export function ensureGlobal(re: RegExp): RegExp {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  return new RegExp(re.source, flags)
}
