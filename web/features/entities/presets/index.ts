/**
 * Entities vertical preset registry (L1 Common).
 *
 * Preset *names* live in ring-config `entities.preset`. L1 ships platform only.
 * Vertical catalogs (agricultural, …) live in L2 packs that overwrite this file.
 *
 * Consumers call getEntityTypes() — never import a vertical catalog directly.
 */

import { cache } from 'react'
import type { EntityTypeCatalog, EntitiesPresetModule } from './types'
import { getEntitiesPreset } from '@/lib/ring-config-core'

export type { EntityTypeCatalog, EntityTypeCatalogEntry, EntitiesPresetModule } from './types'

export const ENTITIES_PRESET_REGISTRY = {
  platform: () => import('./platform'),
} as const

export const ERP_CATALOG_REGISTRY: Partial<
  Record<EntitiesPresetName, () => Promise<{ erpEntityTypes: EntityTypeCatalog }>>
> = {}

export type EntitiesPresetName = keyof typeof ENTITIES_PRESET_REGISTRY

const moduleCache = new Map<string, EntitiesPresetModule>()

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

export async function loadErpEntityTypes(): Promise<EntityTypeCatalog> {
  const preset = getEntitiesPreset() as EntitiesPresetName
  const loader = ERP_CATALOG_REGISTRY[preset]
  if (!loader) return {}
  return (await loader()).erpEntityTypes
}

import { entityTypes as platformEntityTypes } from './platform'

const SYNC_CATALOGS: Record<string, EntityTypeCatalog> = {
  platform: platformEntityTypes as unknown as EntityTypeCatalog,
}

export const getEntityTypes = cache((): EntityTypeCatalog => {
  const preset = getEntitiesPreset()
  return SYNC_CATALOGS[preset] ?? SYNC_CATALOGS.platform
})

export const getEntityTypeList = cache((): Array<EntityTypeCatalog[string]> => {
  return Object.values(getEntityTypes())
})

export const getEntityTypeIds = cache((): string[] => {
  return getEntityTypeList().map((e) => e.id)
})
