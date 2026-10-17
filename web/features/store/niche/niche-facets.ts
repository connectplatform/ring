/**
 * Facet shape a pack may derive from the catalog.
 * Layer1's `computeNicheFacets` returns null. Packs overwrite that function.
 */

export interface NicheFacetOption {
  value: string
  label: string
  count: number
}

export interface NicheMultiFacet {
  type: 'multi'
  field: string
  options: NicheFacetOption[]
}

export interface NicheRangeFacet {
  type: 'range'
  field: string
  min: number
  max: number
  step: number
}

export type NicheFacet = NicheMultiFacet | NicheRangeFacet
