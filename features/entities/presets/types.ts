/**
 * Uniform catalog shape for every entities vertical preset.
 * Preset modules under features/entities/presets/<id>.ts MUST export `entityTypes`
 * matching this contract so consumers stay vertical-agnostic.
 */

export interface EntityTypeCatalogEntry {
  id: string
  name: string
  description?: string
  /** Emoji or lucide key — UI maps as needed */
  icon?: string
  requiredFields?: readonly string[]
  /** Optional ERP / form field catalog (agricultural vertical) */
  erpFields?: Record<string, unknown>
}

/** Stable catalog keyed by UPPER_SNAKE or camelCase symbol — consumers iterate Object.values */
export type EntityTypeCatalog = Record<string, EntityTypeCatalogEntry>

export interface EntitiesPresetModule {
  /** Active UI + filter catalog for this vertical (lightweight — safe for client bundles) */
  entityTypes: EntityTypeCatalog
}
