/**
 * ES2022 Enhanced Filter Manager
 * 
 * A comprehensive filter management utility that demonstrates:
 * - Object.hasOwn() for safe property checking
 * - Logical assignment operators (??=, ||=, &&=) for cleaner state management
 * - Modern TypeScript patterns with ES2022 features
 */

import { hasOwnProperty, filterObjectProperties, validateRequiredFields } from '@/lib/utils'

/**
 * Generic filter configuration interface
 */
export interface FilterConfig<T = any> {
  field: keyof T
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'notIn'
  value: any
  caseSensitive?: boolean
}

/**
 * Filter state management with ES2022 logical assignment operators
 */
export class FilterManager<T extends Record<string, any>> {
  private filters: Map<string, FilterConfig<T>> = new Map()
  private cachedResults: Map<string, T[]> = new Map()
  private options: FilterManagerOptions

  constructor(options: FilterManagerOptions = {}) {
    // ES2022 ??= - Assign default values only if undefined/null
    this.options = options
    this.options.cacheEnabled ??= true
    this.options.caseSensitive ??= false
    this.options.maxCacheSize ??= 100
    this.options.debugMode ??= false
  }

  /**
   * Adds or updates a filter using Object.hasOwn() for safe property validation
   */
  setFilter(id: string, config: FilterConfig<T>): this {
    // Validate filter configuration using Object.hasOwn()
    if (!this.validateFilterConfig(config)) {
      throw new Error(`Invalid filter configuration for filter '${id}'`)
    }

    // ES2022 logical assignment for filter options
    const enhancedConfig = { ...config }
    enhancedConfig.caseSensitive ??= this.options.caseSensitive

    this.filters.set(id, enhancedConfig)
    
    // Clear cache when filters change
    if (this.options.cacheEnabled) {
      this.clearCache()
    }

    this.logDebug(`Filter '${id}' set with config:`, enhancedConfig)
    return this
  }

  /**
   * Applies all filters to a dataset using ES2022 Object.hasOwn() for safe property access
   */
  applyFilters(data: T[]): T[] {
    if (!Array.isArray(data) || data.length === 0) {
      return []
    }

    if (this.filters.size === 0) {
      return data
    }

    // Generate cache key from active filters
    const cacheKey = this.generateCacheKey()
    
    // ES2022 ??= - Return cached result if available
    if (this.options.cacheEnabled && this.cachedResults.has(cacheKey)) {
      this.logDebug('Returning cached filter results')
      return this.cachedResults.get(cacheKey) ?? []
    }

    // Apply all filters
    let filteredData = data
    
    for (const [filterId, config] of this.filters) {
      filteredData = this.applySingleFilter(filteredData, config)
      this.logDebug(`Applied filter '${filterId}', results: ${filteredData.length}`)
    }

    // Cache results with size management
    if (this.options.cacheEnabled) {
      this.cacheResults(cacheKey, filteredData)
    }

    return filteredData
  }

  /**
   * Applies a single filter with Object.hasOwn() safety checks
   */
  private applySingleFilter(data: T[], config: FilterConfig<T>): T[] {
    return data.filter(item => {
      // ES2022 Object.hasOwn() for safe property checking
      if (!Object.hasOwn(item, config.field)) {
        return false
      }

      const itemValue = item[config.field]
      const filterValue = config.value

      // Handle different filter operators
      switch (config.operator) {
        case 'equals':
          return this.compareValues(itemValue, filterValue, config.caseSensitive ?? false)
          
        case 'contains':
          return this.stringContains(itemValue, filterValue, config.caseSensitive ?? false)
          
        case 'startsWith':
          return this.stringStartsWith(itemValue, filterValue, config.caseSensitive ?? false)
          
        case 'endsWith':
          return this.stringEndsWith(itemValue, filterValue, config.caseSensitive ?? false)
          
        case 'gt':
          return itemValue > filterValue
          
        case 'lt':
          return itemValue < filterValue
          
        case 'gte':
          return itemValue >= filterValue
          
        case 'lte':
          return itemValue <= filterValue
          
        case 'in':
          return Array.isArray(filterValue) && filterValue.includes(itemValue)
          
        case 'notIn':
          return Array.isArray(filterValue) && !filterValue.includes(itemValue)
          
        default:
          return false
      }
    })
  }

  /**
   * Validates filter configuration using Object.hasOwn()
   */
  private validateFilterConfig(config: any): config is FilterConfig<T> {
    if (!config || typeof config !== 'object') {
      return false
    }

    const requiredFields = ['field', 'operator', 'value'] as const
    return requiredFields.every(field => Object.hasOwn(config, field))
  }

  /**
   * Safe string comparison with optional case sensitivity
   */
  private compareValues(itemValue: any, filterValue: any, caseSensitive: boolean): boolean {
    if (typeof itemValue === 'string' && typeof filterValue === 'string') {
      if (!caseSensitive) {
        return itemValue.toLowerCase() === filterValue.toLowerCase()
      }
      return itemValue === filterValue
    }
    return itemValue === filterValue
  }

  /**
   * Safe string contains check
   */
  private stringContains(itemValue: any, filterValue: any, caseSensitive: boolean): boolean {
    if (typeof itemValue !== 'string' || typeof filterValue !== 'string') {
      return false
    }
    
    const item = caseSensitive ? itemValue : itemValue.toLowerCase()
    const filter = caseSensitive ? filterValue : filterValue.toLowerCase()
    
    return item.includes(filter)
  }

  /**
   * Safe string starts with check
   */
  private stringStartsWith(itemValue: any, filterValue: any, caseSensitive: boolean): boolean {
    if (typeof itemValue !== 'string' || typeof filterValue !== 'string') {
      return false
    }
    
    const item = caseSensitive ? itemValue : itemValue.toLowerCase()
    const filter = caseSensitive ? filterValue : filterValue.toLowerCase()
    
    return item.startsWith(filter)
  }

  /**
   * Safe string ends with check
   */
  private stringEndsWith(itemValue: any, filterValue: any, caseSensitive: boolean): boolean {
    if (typeof itemValue !== 'string' || typeof filterValue !== 'string') {
      return false
    }
    
    const item = caseSensitive ? itemValue : itemValue.toLowerCase()
    const filter = caseSensitive ? filterValue : filterValue.toLowerCase()
    
    return item.endsWith(filter)
  }

  /**
   * Cache management with ES2022 logical assignment
   */
  private cacheResults(key: string, results: T[]): void {
    if (this.cachedResults.size >= (this.options.maxCacheSize ?? 100)) {
      // Remove oldest cache entry
      const firstKey = this.cachedResults.keys().next().value
      this.cachedResults.delete(firstKey)
    }
    
    this.cachedResults.set(key, results)
  }

  /**
   * Generates a cache key from current filters
   */
  private generateCacheKey(): string {
    const filterEntries = Array.from(this.filters.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, config]) => `${id}:${String(config.field)}:${config.operator}:${JSON.stringify(config.value)}`)
    
    return filterEntries.join('|')
  }

  /**
   * Debug logging with conditional execution using logical assignment
   */
  private logDebug(message: string, data?: any): void {
    // ES2022 logical assignment - only log if debug mode is enabled
    if (this.options.debugMode) {
      console.log(`[FilterManager] ${message}`, data || '')
    }
  }

  /**
   * Clear all filters and cache
   */
  clear(): this {
    this.filters.clear()
    this.clearCache()
    return this
  }

  /**
   * Clear cache only
   */
  clearCache(): this {
    this.cachedResults.clear()
    return this
  }

  /**
   * Get current filter count
   */
  get filterCount(): number {
    return this.filters.size
  }

  /**
   * Get all active filters
   */
  getFilters(): Array<[string, FilterConfig<T>]> {
    return Array.from(this.filters.entries())
  }

  /**
   * Remove specific filter
   */
  removeFilter(id: string): this {
    this.filters.delete(id)
    if (this.options.cacheEnabled) {
      this.clearCache()
    }
    return this
  }
}

/**
 * Filter manager options with ES2022 optional properties
 */
export interface FilterManagerOptions {
  cacheEnabled?: boolean
  caseSensitive?: boolean  
  maxCacheSize?: number
  debugMode?: boolean
}

/**
 * Factory function for creating filter managers with predefined configurations
 */
export function createFilterManager<T extends Record<string, any>>(
  options?: FilterManagerOptions
): FilterManager<T> {
  return new FilterManager<T>(options)
}

/**
 * Utility function for processing filter state with Object.hasOwn() safety
 */
export function processFilterState<T extends Record<string, any>>(
  filters: Record<string, any>
): Record<string, T> {
  const validFilters: Record<string, T> = {}
  
  for (const key in filters) {
    // ES2022 Object.hasOwn() for safe property checking
    if (Object.hasOwn(filters, key) && filters[key] !== null && filters[key] !== undefined) {
      validFilters[key] = filters[key]
    }
  }
  
  return validFilters
} 