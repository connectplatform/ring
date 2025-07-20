"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, Filter, X } from 'lucide-react'
import { FilterManager, FilterConfig, createFilterManager } from '@/lib/filter-manager'
import { hasOwnProperty, validateRequiredFields } from '@/lib/utils'

/**
 * ES2022 Enhanced Advanced Filter Component
 * 
 * Demonstrates:
 * - Object.hasOwn() for safe property validation
 * - Logical assignment operators (??=, ||=, &&=) for state management
 * - Modern React patterns with ES2022 features
 */

export interface AdvancedFilterProps<T extends Record<string, any>> {
  data: T[]
  fields: Array<{
    key: keyof T
    label: string
    type: 'string' | 'number' | 'date' | 'boolean'
  }>
  onFilteredData: (filtered: T[]) => void
  initialFilters?: Record<string, FilterConfig<T>>
  className?: string
}

interface FilterState {
  field: string
  operator: string
  value: string
  caseSensitive: boolean
}

interface ComponentState {
  filterManager: FilterManager<any>
  activeFilters: Map<string, FilterState>
  newFilter: FilterState
  isLoading: boolean
  error: string | null
}

export function AdvancedFilterComponent<T extends Record<string, any>>({
  data,
  fields,
  onFilteredData,
  initialFilters,
  className = ''
}: AdvancedFilterProps<T>) {
  
  // ES2022 Enhanced State Management with logical assignment operators
  const [state, setState] = useState<ComponentState>(() => {
    const initialState: ComponentState = {
      filterManager: createFilterManager<T>({ 
        cacheEnabled: true, 
        debugMode: process.env.NODE_ENV === 'development' 
      }),
      activeFilters: new Map(),
      newFilter: {
        field: '',
        operator: 'equals',
        value: '',
        caseSensitive: false
      },
      isLoading: false,
      error: null
    }

    // ES2022 ??= - Apply initial filters only if provided
    if (initialFilters) {
      Object.entries(initialFilters).forEach(([id, config]) => {
        if (validateFilterConfig(config)) {
          initialState.filterManager.setFilter(id, config)
          initialState.activeFilters.set(id, configToState(config))
        }
      })
    }

    return initialState
  })

  /**
   * ES2022 Object.hasOwn() validation for filter configuration
   */
  const validateFilterConfig = useCallback((config: any): config is FilterConfig<T> => {
    if (!config || typeof config !== 'object') {
      return false
    }

    const requiredFields = ['field', 'operator', 'value'] as const
    return requiredFields.every(field => Object.hasOwn(config, field))
  }, [])

  /**
   * Convert filter config to component state
   */
  const configToState = useCallback((config: FilterConfig<T>): FilterState => {
    return {
      field: String(config.field),
      operator: config.operator,
      value: String(config.value),
      caseSensitive: config.caseSensitive ?? false
    }
  }, [])

  /**
   * Apply filters with ES2022 enhancements
   */
  const applyFilters = useCallback(() => {
    setState(prevState => {
      const newState = { ...prevState }
      
      // ES2022 logical assignment for loading state
      newState.isLoading ||= true
      newState.error ??= null

      try {
        const filteredData = newState.filterManager.applyFilters(data)
        onFilteredData(filteredData)
        
        // Reset error state using logical assignment
        newState.error &&= null
      } catch (error) {
        newState.error = error instanceof Error ? error.message : 'Filter operation failed'
      }

      // ES2022 &&= - Set loading to false only if it was true
      newState.isLoading &&= false
      
      return newState
    })
  }, [data, onFilteredData])

  /**
   * Add new filter with Object.hasOwn() validation
   */
  const addFilter = useCallback(() => {
    setState(prevState => {
      const newState = { ...prevState }
      
      // ES2022 Object.hasOwn() validation for filter fields
      const selectedField = fields.find(f => f.key === newState.newFilter.field)
      if (!selectedField || !newState.newFilter.value.trim()) {
        newState.error = 'Please select a field and enter a value'
        return newState
      }

      // Validate field exists in data using Object.hasOwn()
      const hasValidField = data.length > 0 && Object.hasOwn(data[0], newState.newFilter.field)
      if (!hasValidField) {
        newState.error = `Field '${newState.newFilter.field}' not found in data`
        return newState
      }

      // Create filter configuration
      const filterId = `filter_${Date.now()}`
      const filterConfig: FilterConfig<T> = {
        field: newState.newFilter.field as keyof T,
        operator: newState.newFilter.operator as any,
        value: parseFilterValue(newState.newFilter.value, selectedField.type),
        caseSensitive: newState.newFilter.caseSensitive
      }

      // Add to filter manager and state
      newState.filterManager.setFilter(filterId, filterConfig)
      newState.activeFilters.set(filterId, { ...newState.newFilter })

      // Reset new filter form using ES2022 logical assignment
      newState.newFilter.field ||= ''
      newState.newFilter.value = ''
      newState.error &&= null

      return newState
    })
  }, [data, fields])

  /**
   * Remove filter with cleanup
   */
  const removeFilter = useCallback((filterId: string) => {
    setState(prevState => {
      const newState = { ...prevState }
      
      newState.filterManager.removeFilter(filterId)
      newState.activeFilters.delete(filterId)
      
      return newState
    })
  }, [])

  /**
   * Clear all filters
   */
  const clearAllFilters = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      filterManager: prevState.filterManager.clear(),
      activeFilters: new Map(),
      error: null
    }))
  }, [])

  /**
   * Parse filter value based on field type
   */
  const parseFilterValue = useCallback((value: string, type: string): any => {
    switch (type) {
      case 'number':
        return Number(value) || 0
      case 'boolean':
        return value.toLowerCase() === 'true'
      case 'date':
        return new Date(value)
      default:
        return value
    }
  }, [])

  /**
   * Update new filter state with ES2022 logical assignment
   */
  const updateNewFilter = useCallback((updates: Partial<FilterState>) => {
    setState(prevState => {
      const newState = { ...prevState }
      
      // ES2022 logical assignment operators for state updates
      Object.entries(updates).forEach(([key, value]) => {
        if (Object.hasOwn(newState.newFilter, key)) {
          (newState.newFilter as any)[key] = value
        }
      })
      
      // Clear error when user makes changes
      newState.error &&= null
      
      return newState
    })
  }, [])

  // Apply filters when data or active filters change
  useEffect(() => {
    if (state.activeFilters.size > 0) {
      applyFilters()
    } else {
      onFilteredData(data)
    }
  }, [data, state.activeFilters.size, applyFilters, onFilteredData])

  /**
   * Memoized operator options for different field types
   */
  const operatorOptions = useMemo(() => {
    const selectedField = fields.find(f => f.key === state.newFilter.field)
    
    if (!selectedField) {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' }
      ]
    }

    // ES2022 Object.hasOwn() for safe property checking in options
    const baseOptions = [
      { value: 'equals', label: 'Equals' },
      { value: 'notEquals', label: 'Not Equals' }
    ]

    if (selectedField.type === 'string') {
      baseOptions.push(
        { value: 'contains', label: 'Contains' },
        { value: 'startsWith', label: 'Starts With' },
        { value: 'endsWith', label: 'Ends With' }
      )
    }

    if (selectedField.type === 'number' || selectedField.type === 'date') {
      baseOptions.push(
        { value: 'gt', label: 'Greater Than' },
        { value: 'lt', label: 'Less Than' },
        { value: 'gte', label: 'Greater Than or Equal' },
        { value: 'lte', label: 'Less Than or Equal' }
      )
    }

    return baseOptions
  }, [fields, state.newFilter.field])

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Advanced Filters
            </CardTitle>
            <CardDescription>
              Filter data using multiple criteria with ES2022 enhanced safety
            </CardDescription>
          </div>
          {state.activeFilters.size > 0 && (
            <Button 
              onClick={clearAllFilters} 
              variant="outline" 
              size="sm"
              className="text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error Display */}
        {state.error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {state.error}
          </div>
        )}

        {/* Active Filters */}
        {state.activeFilters.size > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active Filters ({state.activeFilters.size})</Label>
            <div className="flex flex-wrap gap-2">
              {Array.from(state.activeFilters.entries()).map(([filterId, filter]) => (
                <div
                  key={filterId}
                  className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                >
                  <span>
                    {filter.field} {filter.operator} "{filter.value}"
                  </span>
                  <Button
                    onClick={() => removeFilter(filterId)}
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-primary/20"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Filter */}
        <div className="border border-dashed border-muted-foreground/25 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            {/* Field Selection */}
            <div className="space-y-2">
              <Label htmlFor="field">Field</Label>
              <Select
                value={state.newFilter.field}
                onValueChange={(value) => updateNewFilter({ field: value })}
              >
                <SelectTrigger id="field">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={String(field.key)} value={String(field.key)}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Operator Selection */}
            <div className="space-y-2">
              <Label htmlFor="operator">Operator</Label>
              <Select
                value={state.newFilter.operator}
                onValueChange={(value) => updateNewFilter({ operator: value })}
              >
                <SelectTrigger id="operator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operatorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value Input */}
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={state.newFilter.value}
                onChange={(e) => updateNewFilter({ value: e.target.value })}
                placeholder="Enter filter value"
                disabled={!state.newFilter.field}
              />
            </div>

            {/* Case Sensitivity (for string fields) */}
            <div className="space-y-2">
              <Label htmlFor="caseSensitive">Options</Label>
              <div className="flex items-center space-x-2 h-10">
                <input
                  type="checkbox"
                  id="caseSensitive"
                  checked={state.newFilter.caseSensitive}
                  onChange={(e) => updateNewFilter({ caseSensitive: e.target.checked })}
                  className="rounded border-input"
                  disabled={!state.newFilter.field || 
                    fields.find(f => f.key === state.newFilter.field)?.type !== 'string'
                  }
                />
                <Label htmlFor="caseSensitive" className="text-sm">
                  Case sensitive
                </Label>
              </div>
            </div>

            {/* Add Button */}
            <Button 
              onClick={addFilter}
              disabled={!state.newFilter.field || !state.newFilter.value.trim()}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </div>
        </div>

        {/* Filter Statistics */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {state.activeFilters.size} filter{state.activeFilters.size !== 1 ? 's' : ''} active
          </span>
          <span>
            Cache: {state.filterManager ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
} 