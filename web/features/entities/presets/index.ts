/**
 * Entities vertical preset registry (Tier-2 SSOT).
 *
 * Preset *names* live in ring-config `entities.preset` (+ this registry map).
 * Shared niches ship in ring-platform.org; clone-specific niches live in the clone
 * project dir (same relative paths) and are merged via ringdom-clone-build
 * (platform → tmp, then clone overlay — clone truth prevails). Overlay this
 * index.ts on the clone when adding a custom registry entry.
 *
 * Consumers call getEntityTypes() — never import agricultural.ts / platform.ts directly
 * (except when extending a new vertical).
 *
 * Bundle discipline: sync catalogs are lightweight UI lists only.
 * Heavy ERP field catalogs load ONLY via async loadErpEntityTypes().
 */

import { cache } from 'react'
import type { EntityTypeCatalog, EntitiesPresetModule } from './types'
import { getEntitiesPreset } from '@/lib/ring-config-core'

export type { EntityTypeCatalog, EntityTypeCatalogEntry, EntitiesPresetModule } from './types'

/** Registered verticals — add new presets here only */
export const ENTITIES_PRESET_REGISTRY = {
  platform: () => import('./platform'),
  agricultural: () => import('./agricultural'),
} as const

/** Heavy ERP catalogs per vertical — async-only, never in sync/client path */
export const ERP_CATALOG_REGISTRY: Partial<
  Record<EntitiesPresetName, () => Promise<{ erpEntityTypes: EntityTypeCatalog }>>
> = {
  agricultural: () => import('./agricultural-erp'),
}

export type EntitiesPresetName = keyof typeof ENTITIES_PRESET_REGISTRY

const moduleCache = new Map<string, EntitiesPresetModule>()

/** Resolve preset module via dynamic import registry; warms cache on first call. */
export async function loadEntitiesPreset(
  name: EntitiesPresetName = 'platform'
): Promise<EntitiesPresetModule> {
  const cached = moduleCache.get(name)
  if (cached) return cached
  const loader = ENTITIES_PRESET_REGISTRY[name] ?? ENTITIES_PRESET_REGISTRY.platform
  const mod = await loader()
  const resolved: EntitiesPresetModule = { entityTypes: mod.entityTypes }
  moduleCache.set(name, resolved)
  return resolved
}

/**
 * Heavy ERP field catalog for the active vertical (server-side / async boundaries only).
 * Returns {} for verticals without ERP catalogs.
 */
export async function loadErpEntityTypes(): Promise<EntityTypeCatalog> {
  const preset = getEntitiesPreset() as EntitiesPresetName
  const loader = ERP_CATALOG_REGISTRY[preset]
  if (!loader) return {}
  return (await loader()).erpEntityTypes
}

/** Eager sync UI catalogs (small — names/ids/emoji only, no ERP fields). */
import { entityTypes as platformEntityTypes } from './platform'
import { entityTypes as agriculturalEntityTypes } from './agricultural'

const SYNC_CATALOGS: Record<EntitiesPresetName, EntityTypeCatalog> = {
  platform: platformEntityTypes as unknown as EntityTypeCatalog,
  agricultural: agriculturalEntityTypes,
}

/**
 * Active entity type UI catalog for this clone (ring-config entities.preset).
 * Cached per request via React cache().
 */
export const getEntityTypes = cache((): EntityTypeCatalog => {
  const preset = getEntitiesPreset() as EntitiesPresetName
  return SYNC_CATALOGS[preset] ?? SYNC_CATALOGS.platform
})

/** Flattened list of catalog entries (for selects / filters). */
export const getEntityTypeList = cache((): Array<EntityTypeCatalog[string]> => {
  return Object.values(getEntityTypes())
})

/** All known entity type ids for the active preset. */
export const getEntityTypeIds = cache((): string[] => {
  return getEntityTypeList().map((e) => e.id)
})
