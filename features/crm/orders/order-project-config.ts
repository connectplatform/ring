import { z } from 'zod'

/**
 * Order Project Config — allowlisted deep-partial ring-config overlay
 * stored on project_orders.data.projectConfig (control-plane SSOT).
 */

export const orderProjectConfigSchema = z
  .object({
    clone: z
      .object({
        displayName: z.string().min(1).max(120).optional(),
        shortName: z.string().max(64).optional(),
        description: z.string().max(2000).optional(),
        organization: z.string().max(120).optional(),
        contactEmail: z.string().email().optional().or(z.literal('')),
      })
      .optional(),
    branding: z
      .object({
        slogan: z.string().max(200).optional(),
        shortDescription: z.string().max(500).optional(),
        extendedDescription: z.string().max(4000).optional(),
        colors: z
          .object({
            primary: z.string().optional(),
            background: z.string().optional(),
            foreground: z.string().optional(),
            accent: z.string().optional(),
          })
          .optional(),
        logoUrl: z.string().url().optional().or(z.literal('')),
        faviconUrl: z.string().url().optional().or(z.literal('')),
        ogImageUrl: z.string().url().optional().or(z.literal('')),
      })
      .optional(),
    seo: z
      .object({
        titleSuffix: z.string().max(120).optional(),
        defaultDescription: z.string().max(500).optional(),
      })
      .optional(),
    contact: z
      .object({
        address: z.string().max(500).optional(),
        phone: z.string().max(64).optional(),
        email: z.string().email().optional().or(z.literal('')),
      })
      .optional(),
    features: z.record(z.string(), z.boolean()).optional(),
    customEntityCategories: z.array(z.string().min(1).max(64)).max(40).optional(),
    /** Tier-2 landing preset id (e.g. n9life-landing) */
    home: z
      .object({
        preset: z.string().min(1).max(64).optional(),
      })
      .optional(),
    /** Tier-2 entities catalog preset */
    entities: z
      .object({
        preset: z.string().min(1).max(64).optional(),
      })
      .optional(),
    productFields: z
      .object({
        preset: z.string().min(1).max(64).optional(),
      })
      .optional(),
    /** Tier-3 domain overlay id → top-level ring-config key + features/<id> */
    domainFeatureId: z
      .string()
      .regex(/^[a-z][a-z0-9]*$/)
      .max(32)
      .optional(),
  })
  .strict()

export type OrderProjectConfig = z.infer<typeof orderProjectConfigSchema>

/** Buyer may only patch these top-level paths (vital identity). */
export const BUYER_PROJECT_CONFIG_MASK = {
  clone: ['displayName', 'shortName', 'description'] as const,
  branding: [
    'slogan',
    'shortDescription',
    'extendedDescription',
    'logoUrl',
    'colors',
  ] as const,
} as const

export function emptyOrderProjectConfig(): OrderProjectConfig {
  return {}
}

/** Deep-merge patch into base (objects only; arrays replace). */
export function mergeOrderProjectConfig(
  base: OrderProjectConfig,
  patch: OrderProjectConfig,
): OrderProjectConfig {
  const out: OrderProjectConfig = { ...base }
  for (const key of Object.keys(patch) as Array<keyof OrderProjectConfig>) {
    const pv = patch[key]
    if (pv === undefined) continue
    const bv = base[key]
    if (
      pv &&
      typeof pv === 'object' &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      ;(out as Record<string, unknown>)[key as string] = {
        ...(bv as object),
        ...(pv as object),
        ...('colors' in (pv as object) && 'colors' in (bv as object)
          ? {
              colors: {
                ...((bv as { colors?: object }).colors || {}),
                ...((pv as { colors?: object }).colors || {}),
              },
            }
          : {}),
      }
    } else {
      ;(out as Record<string, unknown>)[key as string] = pv
    }
  }
  return out
}

/** Strip patch to buyer-allowed vital fields only. */
export function maskBuyerProjectConfigPatch(patch: OrderProjectConfig): OrderProjectConfig {
  const out: OrderProjectConfig = {}
  if (patch.clone) {
    out.clone = {}
    for (const k of BUYER_PROJECT_CONFIG_MASK.clone) {
      const v = patch.clone[k]
      if (v !== undefined) out.clone[k] = v
    }
    if (Object.keys(out.clone).length === 0) delete out.clone
  }
  if (patch.branding) {
    out.branding = {}
    for (const k of BUYER_PROJECT_CONFIG_MASK.branding) {
      const v = patch.branding[k as keyof typeof patch.branding]
      if (v !== undefined) {
        ;(out.branding as Record<string, unknown>)[k] = v
      }
    }
    if (Object.keys(out.branding).length === 0) delete out.branding
  }
  return out
}

/** Map Order Project Config → ConfigMap public env mirrors + overlay JSON. */
export function projectConfigToConfigMapEnv(
  config: OrderProjectConfig,
): Record<string, string> {
  const env: Record<string, string> = {}
  const name = config.clone?.displayName?.trim()
  const slogan =
    config.branding?.slogan?.trim() || config.branding?.shortDescription?.trim()
  const logo = config.branding?.logoUrl?.trim()
  const og = config.branding?.ogImageUrl?.trim()
  if (name) env.NEXT_PUBLIC_BRAND_NAME = name
  if (slogan) env.NEXT_PUBLIC_BRAND_TAGLINE = slogan
  if (logo) env.NEXT_PUBLIC_BRAND_LOGO = logo
  if (og) env.NEXT_PUBLIC_BRAND_OG_IMAGE = og
  env.RING_ORDER_PROJECT_CONFIG = JSON.stringify(config)
  return env
}

/** Shape suitable for mergeDeep into RingConfig file snapshot. */
export function projectConfigToRingOverlay(config: OrderProjectConfig): Record<string, unknown> {
  const overlay: Record<string, unknown> = {}
  if (config.clone) {
    overlay.clone = { ...config.clone }
  }
  if (config.branding) {
    const { slogan, shortDescription, extendedDescription, colors, logoUrl, faviconUrl, ogImageUrl } =
      config.branding
    overlay.branding = {
      ...(slogan || shortDescription
        ? { tagline: slogan || shortDescription }
        : {}),
      ...(extendedDescription ? { description: extendedDescription } : {}),
      ...(colors ? { colors } : {}),
      ...(logoUrl ? { logo: logoUrl } : {}),
      ...(faviconUrl ? { favicon: faviconUrl } : {}),
      ...(ogImageUrl ? { ogImage: ogImageUrl } : {}),
    }
  }
  if (config.seo) overlay.seo = { ...config.seo }
  if (config.contact) overlay.contact = { ...config.contact }
  if (config.features) {
    // InstanceConfig uses flat booleans; RingConfig often nests — store both-friendly flat map under features
    overlay.features = { ...config.features }
  }
  if (config.home?.preset) {
    overlay.home = { preset: config.home.preset }
  }
  if (config.entities?.preset) {
    overlay.entities = { preset: config.entities.preset }
  }
  if (config.productFields?.preset) {
    overlay.productFields = { preset: config.productFields.preset }
  }
  if (config.domainFeatureId) {
    // Signal Tier-3 domain block presence for getOverlayFeature()
    overlay[config.domainFeatureId] = {
      ...(typeof overlay[config.domainFeatureId] === 'object' &&
      overlay[config.domainFeatureId] !== null
        ? (overlay[config.domainFeatureId] as Record<string, unknown>)
        : {}),
      enabled: true,
    }
  }
  return overlay
}
