/**
 * Server/shared bridge: active entities vertical catalog from ring-config preset.
 * Prefer this over importing features/entities/presets/<name> directly.
 */

export {
  getEntityTypes,
  loadErpEntityTypes,
  getEntityTypeList,
  getEntityTypeIds,
  loadEntitiesPreset,
  ENTITIES_PRESET_REGISTRY,
  type EntitiesPresetName,
  type EntityTypeCatalog,
  type EntityTypeCatalogEntry,
} from '@/features/entities/presets'

export { getEntitiesPreset, getProductFieldsPreset, getProductBadgesPreset } from '@/lib/ring-config-core'
