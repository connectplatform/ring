/** Shared marketplace category IDs — ring-platform.org vendor onboarding + store filters. */
export const STORE_VENDOR_CATEGORY_IDS = [
  'ring-platform',
  'dev-kits',
  'ai-tools',
  'expert-services',
  'digital-templates',
  'learn',
  'community',
  'saas-assets',
] as const

export type StoreVendorCategoryId = (typeof STORE_VENDOR_CATEGORY_IDS)[number]

export const STORE_VENDOR_CATEGORY_META: Record<
  StoreVendorCategoryId,
  { icon: string; colorClass: string }
> = {
  'ring-platform': { icon: '💍', colorClass: 'from-violet-500/20 to-indigo-500/20' },
  'dev-kits': { icon: '🧰', colorClass: 'from-blue-500/20 to-cyan-500/20' },
  'ai-tools': { icon: '🤖', colorClass: 'from-purple-500/20 to-fuchsia-500/20' },
  'expert-services': { icon: '🛠️', colorClass: 'from-amber-500/20 to-orange-500/20' },
  'digital-templates': { icon: '📄', colorClass: 'from-slate-500/20 to-gray-500/20' },
  learn: { icon: '📚', colorClass: 'from-emerald-500/20 to-teal-500/20' },
  community: { icon: '👥', colorClass: 'from-pink-500/20 to-rose-500/20' },
  'saas-assets': { icon: '☁️', colorClass: 'from-sky-500/20 to-blue-500/20' },
}
