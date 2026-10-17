export type CityMapCategory =
  | 'all'
  | 'shelters'
  | 'utilities'
  | 'healthcare'
  | 'civic_311'
  | 'local_producers'

export interface CityMapPoi {
  id: string
  title: string
  subtitle: string
  category: Exclude<CityMapCategory, 'all'>
  rawType?: string
  sourceKind: 'entity' | 'opportunity' | 'product' | 'baseline'
  district: string
  address?: string
  lat: number
  lng: number
  href: string
  asOf?: string
  phone?: string
  hours?: string
  isBaselineReference?: boolean
  verified?: boolean
}

export interface BaselineNeedMatch {
  id: string
  kind: 'opportunity' | 'entity' | 'product' | 'user'
  title: string
  subtitle: string
  searchableText: string
  category?: string
  district?: string
  price?: string
  currency?: string
  targetUserId?: string
  entityId?: string
  href: string
}

export interface CityMapCenter {
  lat: number
  lng: number
  label: string
}
